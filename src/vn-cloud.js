/* =========================================================================
   VN — Module Cloud : authentification (sign-up / sign-in) + synchronisation
   Supabase. Ce fichier est injecté dans l'application au moment du build.
   ========================================================================= */
(function () {
    'use strict';

    var CFG = window.VN_CONFIG || {};
    var SUPABASE_URL = CFG.supabaseUrl || 'https://unqfifaiywxuoqqtunya.supabase.co';
    var SUPABASE_KEY = CFG.supabaseAnonKey || '';

    var STORAGE_KEY = 'kanban-data';
    var ARCHIVE_KEY = 'kanban-archive';

    var sb = null;
    var session = null;
    var user = null;
    var profile = null;
    var knownRevision = 0;
    var initializedRemote = false;
    var lastPullAt = 0;
    var pushTimer = null;
    var pushInFlight = false;
    var pushPending = false;
    var retryDelay = 2000;
    var realtimeChannel = null;
    var applyingRemote = false;
    var booted = false;
    var loginResolve = null;
    var authMode = 'signin'; // signin | signup | recover | update-password

    /* ------------------------------------------------------------------ */
    /*  Utilitaires                                                       */
    /* ------------------------------------------------------------------ */
    function el(tag, attrs, children) {
        var node = document.createElement(tag);
        if (attrs) {
            Object.keys(attrs).forEach(function (k) {
                if (k === 'class') node.className = attrs[k];
                else if (k === 'html') node.innerHTML = attrs[k];
                else if (k === 'text') node.textContent = attrs[k];
                else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') {
                    node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
                } else if (attrs[k] !== null && attrs[k] !== undefined) {
                    node.setAttribute(k, attrs[k]);
                }
            });
        }
        (children || []).forEach(function (c) {
            if (c) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
        });
        return node;
    }

    function toast(message, kind) {
        if (typeof window.showToast === 'function' && booted) {
            try { window.showToast(message); return; } catch (e) { /* fallback */ }
        }
        var host = document.getElementById('vn-cloud-toasts');
        if (!host) {
            host = el('div', { id: 'vn-cloud-toasts', class: 'vnc-toasts' });
            document.body.appendChild(host);
        }
        var t = el('div', { class: 'vnc-toast vnc-toast-' + (kind || 'info'), text: message });
        host.appendChild(t);
        requestAnimationFrame(function () { t.classList.add('is-in'); });
        setTimeout(function () {
            t.classList.remove('is-in');
            setTimeout(function () { if (t.parentNode) t.remove(); }, 320);
        }, 4200);
    }

    function initials(email, name) {
        var source = (name || email || '?').trim();
        var parts = source.split(/[\s.@_-]+/).filter(Boolean);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return source.slice(0, 2).toUpperCase();
    }

    function isValidEmail(v) {
        return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(String(v || '').trim());
    }

    function passwordScore(pwd) {
        var score = 0;
        if (!pwd) return 0;
        if (pwd.length >= 6) score++;
        if (pwd.length >= 10) score++;
        if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
        if (/\d/.test(pwd)) score++;
        if (/[^A-Za-z0-9]/.test(pwd)) score++;
        return Math.min(score, 4);
    }

    function translateAuthError(error) {
        var msg = (error && (error.message || error.error_description || error.msg)) || 'Erreur inconnue';
        var code = (error && error.code) || '';
        var m = msg.toLowerCase();
        if (m.indexOf('invalid login credentials') >= 0) return 'E-mail ou mot de passe incorrect.';
        if (m.indexOf('email not confirmed') >= 0) return "Votre e-mail n'est pas encore confirmé. Vérifiez votre boîte de réception.";
        if (m.indexOf('user already registered') >= 0 || m.indexOf('already been registered') >= 0) return 'Un compte existe déjà avec cet e-mail. Connectez-vous plutôt.';
        if (m.indexOf('password should be at least') >= 0) return 'Le mot de passe est trop court (6 caractères minimum).';
        if (m.indexOf('rate limit') >= 0 || m.indexOf('too many') >= 0) return 'Trop de tentatives. Merci de patienter quelques instants.';
        if (m.indexOf('unable to validate email') >= 0 || m.indexOf('invalid email') >= 0) return "Cette adresse e-mail n'est pas valide.";
        if (m.indexOf('signups not allowed') >= 0 || m.indexOf('signup is disabled') >= 0) return 'Les inscriptions sont désactivées sur ce projet.';
        if (m.indexOf('network') >= 0 || m.indexOf('failed to fetch') >= 0) return 'Connexion impossible. Vérifiez votre réseau puis réessayez.';
        if (m.indexOf('same password') >= 0) return 'Le nouveau mot de passe doit être différent de l’ancien.';
        if (code === 'invalid_credentials') return 'E-mail ou mot de passe incorrect.';
        return msg;
    }

    /* ------------------------------------------------------------------ */
    /*  Feuille de style                                                  */
    /* ------------------------------------------------------------------ */
    function injectStyles() {
        if (document.getElementById('vn-cloud-styles')) return;
        var css = [
            ':root{--vn-blue:#0071E3;--vn-blue-dark:#0059B2;--vn-ink:#0B1120;--vn-sub:#64748B;--vn-line:#E3E8EF;--vn-red:#DC2626;--vn-green:#12A150;}',
            '.vnc-hidden{display:none !important;}',

            /* ---- Auth overlay ---- */
            '.vnc-auth{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-start;justify-content:center;padding:24px 20px;',
            'font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif;',
            'background:radial-gradient(1200px 600px at 12% -10%,#E8F1FF 0%,transparent 60%),radial-gradient(900px 500px at 105% 110%,#EEF2FF 0%,transparent 55%),#F7F9FC;',
            'overflow-y:auto;-webkit-overflow-scrolling:touch;}',
            '.vnc-orb{position:absolute;border-radius:50%;filter:blur(70px);opacity:.55;pointer-events:none;}',
            '.vnc-orb.a{width:340px;height:340px;background:#BFDBFE;top:-90px;left:-70px;}',
            '.vnc-orb.b{width:300px;height:300px;background:#C7D2FE;bottom:-90px;right:-60px;}',
            '.vnc-card{position:relative;margin:auto;width:100%;max-width:430px;background:rgba(255,255,255,.86);backdrop-filter:saturate(180%) blur(24px);',
            '-webkit-backdrop-filter:saturate(180%) blur(24px);border:1px solid rgba(226,232,240,.9);border-radius:26px;',
            'box-shadow:0 28px 70px -20px rgba(15,23,42,.28),0 2px 8px rgba(15,23,42,.06);padding:32px 30px 26px;}',
            '.vnc-brand{display:flex;align-items:center;gap:12px;margin-bottom:22px;}',
            '.vnc-logo{width:46px;height:46px;border-radius:14px;background:linear-gradient(145deg,#0A84FF,#0057C8);display:flex;',
            'align-items:center;justify-content:center;box-shadow:0 8px 20px -6px rgba(0,113,227,.65);flex-shrink:0;}',
            '.vnc-logo svg{width:26px;height:26px;}',
            '.vnc-brand h1{font-size:19px;line-height:1.15;margin:0;color:var(--vn-ink);font-weight:700;letter-spacing:-.02em;}',
            '.vnc-brand p{margin:2px 0 0;font-size:12.5px;color:var(--vn-sub);font-weight:500;}',
            '.vnc-title{font-size:23px;font-weight:700;letter-spacing:-.03em;color:var(--vn-ink);margin:0 0 6px;}',
            '.vnc-subtitle{font-size:13.5px;color:var(--vn-sub);margin:0 0 22px;line-height:1.5;}',
            '.vnc-tabs{display:flex;gap:4px;background:#EEF2F7;border-radius:13px;padding:4px;margin-bottom:20px;}',
            '.vnc-tab{flex:1;border:0;background:transparent;padding:9px 10px;font-size:13.5px;font-weight:600;color:#5B6B82;',
            'border-radius:10px;cursor:pointer;transition:.18s;font-family:inherit;}',
            '.vnc-tab.is-active{background:#fff;color:var(--vn-ink);box-shadow:0 1px 4px rgba(15,23,42,.12);}',
            '.vnc-field{margin-bottom:14px;}',
            '.vnc-label{display:block;font-size:12.5px;font-weight:600;color:#3D4A5C;margin-bottom:6px;letter-spacing:-.01em;}',
            '.vnc-input-wrap{position:relative;display:flex;align-items:center;}',
            '.vnc-input-wrap svg.vnc-field-icon{position:absolute;left:13px;width:17px;height:17px;color:#94A3B8;pointer-events:none;}',
            '.vnc-input{width:100%;box-sizing:border-box;height:46px;padding:0 44px 0 40px;border-radius:12px;border:1.5px solid var(--vn-line);',
            'background:#fff;font-size:14.5px;color:var(--vn-ink);font-family:inherit;transition:.16s;outline:none;}',
            '.vnc-input::placeholder{color:#A9B4C4;}',
            '.vnc-input:focus{border-color:var(--vn-blue);box-shadow:0 0 0 4px rgba(0,113,227,.13);}',
            '.vnc-input.is-error{border-color:var(--vn-red);box-shadow:0 0 0 4px rgba(220,38,38,.1);}',
            '.vnc-eye{position:absolute;right:8px;width:32px;height:32px;border:0;background:transparent;color:#94A3B8;cursor:pointer;',
            'display:flex;align-items:center;justify-content:center;border-radius:8px;}',
            '.vnc-eye:hover{background:#F1F5F9;color:#475569;}',
            '.vnc-eye svg{width:18px;height:18px;}',
            '.vnc-hint{font-size:11.5px;color:var(--vn-sub);margin-top:6px;min-height:15px;line-height:1.45;}',
            '.vnc-meter{display:flex;gap:4px;margin-top:8px;}',
            '.vnc-meter span{height:4px;flex:1;border-radius:3px;background:#E5EAF1;transition:.25s;}',
            '.vnc-meter.s1 span:nth-child(1){background:#EF4444;}',
            '.vnc-meter.s2 span:nth-child(-n+2){background:#F59E0B;}',
            '.vnc-meter.s3 span:nth-child(-n+3){background:#3B82F6;}',
            '.vnc-meter.s4 span{background:#12A150;}',
            '.vnc-alert{display:none;padding:11px 13px;border-radius:11px;font-size:12.8px;line-height:1.45;margin-bottom:14px;',
            'border:1px solid transparent;}',
            '.vnc-alert.show{display:flex;gap:8px;align-items:flex-start;}',
            '.vnc-alert.error{background:#FEF2F2;border-color:#FECACA;color:#B91C1C;}',
            '.vnc-alert.success{background:#F0FDF4;border-color:#BBF7D0;color:#15803D;}',
            '.vnc-alert.info{background:#EFF6FF;border-color:#BFDBFE;color:#1D4ED8;}',
            '.vnc-alert svg{width:16px;height:16px;flex-shrink:0;margin-top:1px;}',
            '.vnc-btn{width:100%;height:46px;border:0;border-radius:12px;background:linear-gradient(135deg,#0A84FF,#0064D2);',
            'color:#fff;font-size:14.5px;font-weight:650;font-family:inherit;cursor:pointer;display:flex;align-items:center;',
            'justify-content:center;gap:8px;transition:.18s;box-shadow:0 10px 22px -12px rgba(0,113,227,.95);}',
            '.vnc-btn:hover{filter:brightness(1.05);transform:translateY(-1px);}',
            '.vnc-btn:active{transform:translateY(0);}',
            '.vnc-btn[disabled]{opacity:.62;cursor:not-allowed;transform:none;box-shadow:none;}',
            '.vnc-btn .vnc-spin{width:16px;height:16px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;',
            'animation:vnspin .7s linear infinite;}',
            '@keyframes vnspin{to{transform:rotate(360deg);}}',
            '.vnc-btn-ghost{background:#fff;color:#374151;border:1.5px solid var(--vn-line);box-shadow:none;}',
            '.vnc-btn-ghost:hover{background:#F8FAFC;border-color:#CBD5E1;}',
            '.vnc-row{display:flex;align-items:center;justify-content:space-between;margin:2px 0 16px;}',
            '.vnc-check{display:flex;align-items:center;gap:7px;font-size:12.5px;color:#4B5563;cursor:pointer;user-select:none;}',
            '.vnc-check input{width:15px;height:15px;accent-color:var(--vn-blue);cursor:pointer;}',
            '.vnc-link{background:none;border:0;padding:0;color:var(--vn-blue);font-size:12.5px;font-weight:600;cursor:pointer;',
            'font-family:inherit;text-decoration:none;}',
            '.vnc-link:hover{text-decoration:underline;}',
            '.vnc-sep{display:flex;align-items:center;gap:10px;margin:18px 0;color:#94A3B8;font-size:11.5px;font-weight:600;letter-spacing:.04em;}',
            '.vnc-sep:before,.vnc-sep:after{content:"";flex:1;height:1px;background:#E5EAF1;}',
            '.vnc-foot{text-align:center;font-size:12.5px;color:var(--vn-sub);margin-top:18px;}',
            '.vnc-legal{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:18px;font-size:11px;color:#94A3B8;text-align:center;line-height:1.4;}',
            '.vnc-legal svg{width:13px;height:13px;flex-shrink:0;}',
            '.vnc-server{display:flex;align-items:center;gap:6px;justify-content:center;margin-top:10px;font-size:11px;color:#94A3B8;}',
            '.vnc-dot{width:6px;height:6px;border-radius:50%;background:#12A150;}',
            '.vnc-dot.off{background:#EF4444;}',

            /* ---- Account chip / menu ---- */
            '.vnc-account{position:relative;display:inline-flex;}',
            '.vnc-avatar{display:flex;align-items:center;gap:8px;height:34px;padding:0 10px 0 4px;border-radius:999px;border:1px solid #E3E8EF;',
            'background:#fff;cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:600;color:#374151;transition:.16s;max-width:190px;}',
            '.vnc-avatar:hover{background:#F8FAFC;border-color:#CBD5E1;}',
            '.vnc-avatar .vnc-ini{width:26px;height:26px;border-radius:50%;background:linear-gradient(140deg,#0A84FF,#0057C8);color:#fff;',
            'display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;letter-spacing:.02em;flex-shrink:0;}',
            '.vnc-avatar .vnc-mail{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px;}',
            '.vnc-menu{position:absolute;right:0;top:calc(100% + 8px);width:250px;background:#fff;border:1px solid #E7ECF3;border-radius:15px;',
            'box-shadow:0 20px 50px -12px rgba(15,23,42,.28);padding:7px;z-index:2147482000;display:none;font-family:inherit;}',
            '.vnc-menu.open{display:block;animation:vnpop .16s ease-out;}',
            '@keyframes vnpop{from{opacity:0;transform:translateY(-5px) scale(.98);}to{opacity:1;transform:none;}}',
            '.vnc-menu-head{padding:10px 11px 11px;border-bottom:1px solid #F1F5F9;margin-bottom:5px;}',
            '.vnc-menu-head strong{display:block;font-size:13px;color:#0B1120;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
            '.vnc-menu-head span{font-size:11.5px;color:#64748B;}',
            '.vnc-menu-item{display:flex;align-items:center;gap:9px;width:100%;padding:9px 11px;border:0;background:none;border-radius:9px;',
            'font-size:13px;color:#374151;cursor:pointer;font-family:inherit;text-align:left;font-weight:500;}',
            '.vnc-menu-item:hover{background:#F1F5F9;}',
            '.vnc-menu-item.danger{color:#DC2626;}',
            '.vnc-menu-item svg{width:16px;height:16px;flex-shrink:0;}',
            '.vnc-menu-item .vnc-badge{margin-left:auto;font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;background:#ECFDF5;color:#059669;}',

            /* ---- Sync pill ---- */
            '.vnc-sync{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;border-radius:999px;background:#F1F5F9;',
            'color:#64748B;font-size:11.5px;font-weight:600;font-family:inherit;border:1px solid transparent;transition:.2s;white-space:nowrap;}',
            '.vnc-sync.ok{background:#ECFDF5;color:#047857;}',
            '.vnc-sync.work{background:#EFF6FF;color:#1D4ED8;}',
            '.vnc-sync.err{background:#FEF2F2;color:#B91C1C;}',
            '.vnc-sync .vnc-sdot{width:6px;height:6px;border-radius:50%;background:currentColor;}',
            '.vnc-sync.work .vnc-sdot{animation:vnpulse 1s infinite;}',
            '@keyframes vnpulse{0%,100%{opacity:1}50%{opacity:.3}}',

            /* ---- Toasts ---- */
            '.vnc-toasts{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:2147483600;display:flex;',
            'flex-direction:column;gap:8px;align-items:center;pointer-events:none;font-family:inherit;}',
            '.vnc-toast{background:#0F172A;color:#fff;padding:10px 16px;border-radius:11px;font-size:12.8px;font-weight:500;',
            'box-shadow:0 12px 30px -8px rgba(15,23,42,.5);opacity:0;transform:translateY(10px);transition:.3s;max-width:90vw;}',
            '.vnc-toast.is-in{opacity:1;transform:none;}',
            '.vnc-toast-error{background:#B91C1C;}',
            '.vnc-toast-success{background:#047857;}',

            /* ---- Boot screen ---- */
            '.vnc-boot{position:fixed;inset:0;z-index:2147483100;display:flex;flex-direction:column;align-items:center;',
            'justify-content:center;gap:16px;background:#F7F9FC;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;}',
            '.vnc-boot .vnc-spin2{width:30px;height:30px;border:3px solid #DBEAFE;border-top-color:#0071E3;border-radius:50%;animation:vnspin .8s linear infinite;}',
            '.vnc-boot span{font-size:13px;color:#64748B;font-weight:500;}',

            '@media (max-width:480px){',
            '.vnc-card{padding:26px 20px 22px;border-radius:22px;}',
            '.vnc-title{font-size:21px;}',
            '.vnc-avatar .vnc-mail{display:none;}',
            '.vnc-avatar{padding:0 6px 0 3px;}',
            '}'
        ].join('');
        var style = document.createElement('style');
        style.id = 'vn-cloud-styles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    /* ------------------------------------------------------------------ */
    /*  Icônes                                                           */
    /* ------------------------------------------------------------------ */
    var I = {
        logo: '<svg viewBox="0 0 32 32" fill="none"><path d="M6 8l6.2 16L16 14.5 19.8 24 26 8" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="26" cy="8" r="2.6" fill="#9EE7FF"/></svg>',
        mail: '<svg class="vnc-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4.5" width="19" height="15" rx="3"/><path d="m3 7 9 6 9-6"/></svg>',
        lock: '<svg class="vnc-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10.5" width="16" height="10.5" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/><circle cx="12" cy="16" r="1.2" fill="currentColor" stroke="none"/></svg>',
        user: '<svg class="vnc-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/></svg>',
        eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
        eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-2.4 3.1"/><path d="M6.5 7.7C3.8 9.5 2 12 2 12s3.6 6 10 6a9.8 9.8 0 0 0 4-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
        shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>',
        alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4.5M12 16h.01"/></svg>',
        check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12.5 5 5L20 6.5"/></svg>',
        sync: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2"/><path d="M21 4v5h-5M3 20v-5h5"/></svg>',
        logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h3"/><path d="m16 16 4-4-4-4"/><path d="M20 12H9"/></svg>',
        key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9 3 3-3 3-2-2"/></svg>',
        arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
    };

    /* ------------------------------------------------------------------ */
    /*  Écran d'authentification                                          */
    /* ------------------------------------------------------------------ */
    var authUI = null;

    function buildAuthUI() {
        if (authUI) return authUI;
        injectStyles();

        var overlay = el('div', { class: 'vnc-auth', id: 'vnc-auth', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Connexion à VN' });
        overlay.appendChild(el('div', { class: 'vnc-orb a' }));
        overlay.appendChild(el('div', { class: 'vnc-orb b' }));

        var card = el('div', { class: 'vnc-card' });

        // Marque
        card.appendChild(el('div', { class: 'vnc-brand' }, [
            el('div', { class: 'vnc-logo', html: I.logo }),
            el('div', {}, [
                el('h1', { text: 'VN' }),
                el('p', { text: 'Gestion de tâches' })
            ])
        ]));

        // Titre dynamique
        var title = el('h2', { class: 'vnc-title', id: 'vnc-title', text: 'Bon retour parmi nous' });
        var subtitle = el('p', { class: 'vnc-subtitle', id: 'vnc-subtitle', text: 'Connectez-vous pour retrouver vos tâches, vos notes et vos archives.' });
        card.appendChild(title);
        card.appendChild(subtitle);

        // Onglets
        var tabs = el('div', { class: 'vnc-tabs', id: 'vnc-tabs' });
        var tabIn = el('button', { class: 'vnc-tab is-active', type: 'button', text: 'Connexion' });
        var tabUp = el('button', { class: 'vnc-tab', type: 'button', text: 'Créer un compte' });
        tabIn.addEventListener('click', function () { setAuthMode('signin'); });
        tabUp.addEventListener('click', function () { setAuthMode('signup'); });
        tabs.appendChild(tabIn); tabs.appendChild(tabUp);
        card.appendChild(tabs);

        // Alerte
        var alertBox = el('div', { class: 'vnc-alert', id: 'vnc-alert', role: 'alert' });
        card.appendChild(alertBox);

        // Formulaire
        var form = el('form', { id: 'vnc-form', novalidate: 'novalidate' });

        // Nom (inscription)
        var fName = el('div', { class: 'vnc-field', id: 'vnc-f-name' }, [
            el('label', { class: 'vnc-label', for: 'vnc-name', text: 'Nom complet' }),
            el('div', { class: 'vnc-input-wrap', html: I.user }),
            el('div', { class: 'vnc-hint', id: 'vnc-hint-name' })
        ]);
        var nameInput = el('input', { class: 'vnc-input', id: 'vnc-name', type: 'text', placeholder: 'Ex. Nomena Andrian', autocomplete: 'name' });
        fName.querySelector('.vnc-input-wrap').appendChild(nameInput);

        // E-mail
        var emailWrap = el('div', { class: 'vnc-input-wrap', html: I.mail });
        var emailInput = el('input', { class: 'vnc-input', id: 'vnc-email', type: 'email', placeholder: 'vous@exemple.com', autocomplete: 'email', inputmode: 'email', autocapitalize: 'none', spellcheck: 'false' });
        emailWrap.appendChild(emailInput);
        var fEmail = el('div', { class: 'vnc-field' }, [
            el('label', { class: 'vnc-label', for: 'vnc-email', text: 'Adresse e-mail' }),
            emailWrap
        ]);

        // Mot de passe
        var pwdWrap = el('div', { class: 'vnc-input-wrap', html: I.lock });
        var pwdInput = el('input', { class: 'vnc-input', id: 'vnc-password', type: 'password', placeholder: '••••••••', autocomplete: 'current-password' });
        var eyeBtn = el('button', { class: 'vnc-eye', type: 'button', 'aria-label': 'Afficher le mot de passe', html: I.eye });
        eyeBtn.addEventListener('click', function () {
            var visible = pwdInput.type === 'text';
            pwdInput.type = visible ? 'password' : 'text';
            eyeBtn.innerHTML = visible ? I.eye : I.eyeOff;
            eyeBtn.setAttribute('aria-label', visible ? 'Afficher le mot de passe' : 'Masquer le mot de passe');
            pwdInput.focus();
        });
        pwdWrap.appendChild(pwdInput);
        pwdWrap.appendChild(eyeBtn);
        var meter = el('div', { class: 'vnc-meter', id: 'vnc-meter' }, [
            el('span'), el('span'), el('span'), el('span')
        ]);
        var pwdHint = el('div', { class: 'vnc-hint', id: 'vnc-hint-pwd' });
        var fPwd = el('div', { class: 'vnc-field' }, [
            el('label', { class: 'vnc-label', for: 'vnc-password', text: 'Mot de passe' }),
            pwdWrap, meter, pwdHint
        ]);

        // Confirmation
        var cPwdWrap = el('div', { class: 'vnc-input-wrap', html: I.lock });
        var cPwdInput = el('input', { class: 'vnc-input', id: 'vnc-password2', type: 'password', placeholder: '••••••••', autocomplete: 'new-password' });
        var eye2 = el('button', { class: 'vnc-eye', type: 'button', 'aria-label': 'Afficher le mot de passe', html: I.eye });
        eye2.addEventListener('click', function () {
            var visible = cPwdInput.type === 'text';
            cPwdInput.type = visible ? 'password' : 'text';
            eye2.innerHTML = visible ? I.eye : I.eyeOff;
            cPwdInput.focus();
        });
        cPwdWrap.appendChild(cPwdInput);
        cPwdWrap.appendChild(eye2);
        var confirmField = el('div', { class: 'vnc-field', id: 'vnc-f-pwd2' }, [
            el('label', { class: 'vnc-label', for: 'vnc-password2', text: 'Confirmer le mot de passe' }),
            cPwdWrap
        ]);

        // Mémorisation + mot de passe oublié
        var remember = el('label', { class: 'vnc-check' });
        var rememberInput = el('input', { type: 'checkbox', checked: 'checked', id: 'vnc-remember' });
        remember.appendChild(rememberInput);
        remember.appendChild(document.createTextNode('Rester connecté'));
        var forgotBtn = el('button', { class: 'vnc-link', type: 'button', text: 'Mot de passe oublié ?' });
        forgotBtn.addEventListener('click', function () { setAuthMode('recover'); });
        var row = el('div', { class: 'vnc-row', id: 'vnc-row-options' }, [remember, forgotBtn]);

        // CGU (inscription)
        var terms = el('label', { class: 'vnc-check', id: 'vnc-f-terms', style: 'margin-bottom:14px;align-items:flex-start;' });
        var termsInput = el('input', { type: 'checkbox', id: 'vnc-terms', style: 'margin-top:1px;' });
        terms.appendChild(termsInput);
        terms.appendChild(el('span', { html: "J'accepte que mes données soient stockées de façon sécurisée dans mon espace personnel." }));

        var submitBtn = el('button', { class: 'vnc-btn', type: 'submit', id: 'vnc-submit' });
        submitBtn.appendChild(el('span', { text: 'Se connecter' }));

        form.appendChild(fName);
        form.appendChild(fEmail);
        form.appendChild(fPwd);
        form.appendChild(confirmField);
        form.appendChild(row);
        form.appendChild(terms);
        form.appendChild(alertBox);
        form.appendChild(submitBtn);

        // Retour (récupération)
        var backBtn = el('button', { class: 'vnc-btn vnc-btn-ghost', type: 'button', id: 'vnc-back', style: 'margin-top:10px;', text: '← Revenir à la connexion' });
        backBtn.addEventListener('click', function () { setAuthMode('signin'); });
        form.appendChild(backBtn);

        card.appendChild(form);

        var foot = el('div', { class: 'vnc-foot', id: 'vnc-foot' });
        card.appendChild(foot);

        card.appendChild(el('div', { class: 'vnc-legal' }, [
            el('span', { html: I.shield }),
            el('span', { text: 'Connexion chiffrée · Données isolées par utilisateur (RLS Supabase)' })
        ]));

        var serverState = el('div', { class: 'vnc-server' }, [
            el('span', { class: 'vnc-dot', id: 'vnc-dot' }),
            el('span', { id: 'vnc-server-label', text: 'Supabase · ' + SUPABASE_URL.replace('https://', '').split('.')[0] })
        ]);
        card.appendChild(serverState);

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        authUI = {
            overlay: overlay, card: card, tabs: tabs, tabIn: tabIn, tabUp: tabUp,
            title: title, subtitle: subtitle, alertBox: alertBox, form: form,
            nameInput: nameInput, emailInput: emailInput, pwdInput: pwdInput,
            cPwdInput: cPwdInput, submitBtn: submitBtn, backBtn: backBtn,
            fName: fName, confirmField: confirmField, row: row, foot: foot,
            meter: meter, pwdHint: pwdHint, terms: terms, termsInput: termsInput,
            rememberInput: rememberInput
        };

        form.addEventListener('submit', onSubmit);
        nameInput.addEventListener('input', clearFieldError);
        emailInput.addEventListener('input', clearFieldError);
        pwdInput.addEventListener('input', function () {
            clearFieldError();
            var s = passwordScore(pwdInput.value);
            meter.className = 'vnc-meter' + (pwdInput.value ? ' s' + s : '');
            if (authMode === 'signup' || authMode === 'update-password') {
                var labels = ['', 'Faible', 'Moyen', 'Bon', 'Excellent'];
                pwdHint.textContent = pwdInput.value ? 'Sécurité : ' + labels[s] : '6 caractères minimum.';
            }
        });
        cPwdInput.addEventListener('input', clearFieldError);

        setAuthMode('signin');
        return authUI;
    }

    function setAuthMode(mode) {
        if (!authUI) return;
        authMode = mode;
        var ui = authUI;
        hideAlert();
        clearFieldError();

        var isSignin = mode === 'signin';
        var isSignup = mode === 'signup';
        var isRecover = mode === 'recover';
        var isUpdate = mode === 'update-password';

        ui.tabs.style.display = (isSignin || isSignup) ? '' : 'none';
        ui.tabIn.classList.toggle('is-active', isSignin);
        ui.tabUp.classList.toggle('is-active', isSignup);

        ui.fName.style.display = isSignup ? '' : 'none';
        ui.confirmField.style.display = (isSignup || isUpdate) ? '' : 'none';
        ui.row.style.display = isSignin ? '' : 'none';
        ui.terms.style.display = isSignup ? '' : 'none';
        ui.meter.style.display = (isSignup || isUpdate) ? '' : 'none';
        ui.pwdHint.style.display = (isSignup || isUpdate) ? '' : 'none';
        ui.backBtn.style.display = (isRecover || isUpdate) ? '' : 'none';
        ui.foot.style.display = (isSignin || isSignup) ? '' : 'none';

        if (isSignin) {
            ui.title.textContent = 'Bon retour parmi nous';
            ui.subtitle.textContent = 'Connectez-vous pour retrouver vos tâches, vos notes et vos archives.';
            ui.submitBtn.querySelector('span').textContent = 'Se connecter';
            ui.pwdInput.setAttribute('autocomplete', 'current-password');
            ui.pwdInput.placeholder = '••••••••';
            ui.foot.innerHTML = '';
            ui.foot.appendChild(document.createTextNode('Pas encore de compte ? '));
            var b = el('button', { class: 'vnc-link', type: 'button', text: 'Créer un compte gratuitement' });
            b.addEventListener('click', function () { setAuthMode('signup'); });
            ui.foot.appendChild(b);
        } else if (isSignup) {
            ui.title.textContent = 'Créer votre compte';
            ui.subtitle.textContent = 'Quelques secondes suffisent pour synchroniser vos tâches sur tous vos appareils.';
            ui.submitBtn.querySelector('span').textContent = 'Créer mon compte';
            ui.pwdInput.setAttribute('autocomplete', 'new-password');
            ui.pwdInput.placeholder = '6 caractères minimum';
            ui.foot.innerHTML = '';
            ui.foot.appendChild(document.createTextNode('Déjà inscrit ? '));
            var b2 = el('button', { class: 'vnc-link', type: 'button', text: 'Se connecter' });
            b2.addEventListener('click', function () { setAuthMode('signin'); });
            ui.foot.appendChild(b2);
        } else if (isRecover) {
            ui.title.textContent = 'Mot de passe oublié';
            ui.subtitle.textContent = 'Saisissez votre e-mail : nous vous enverrons un lien sécurisé pour choisir un nouveau mot de passe.';
            ui.submitBtn.querySelector('span').textContent = 'Envoyer le lien';
        } else if (isUpdate) {
            ui.title.textContent = 'Nouveau mot de passe';
            ui.subtitle.textContent = 'Choisissez un nouveau mot de passe pour sécuriser votre compte.';
            ui.submitBtn.querySelector('span').textContent = 'Enregistrer le mot de passe';
        }
        setTimeout(function () {
            if (isSignup) ui.nameInput.focus();
            else if (isRecover || isUpdate) ui.emailInput.focus();
            else ui.emailInput.focus();
        }, 60);
    }

    function showAlert(kind, message) {
        if (!authUI) return;
        var icon = kind === 'success' ? I.check : (kind === 'info' ? I.sync : I.alert);
        authUI.alertBox.className = 'vnc-alert show ' + kind;
        authUI.alertBox.innerHTML = icon + '<span>' + message + '</span>';
    }

    function hideAlert() {
        if (!authUI) return;
        authUI.alertBox.className = 'vnc-alert';
        authUI.alertBox.innerHTML = '';
    }

    function clearFieldError() {
        if (!authUI) return;
        [authUI.nameInput, authUI.emailInput, authUI.pwdInput, authUI.cPwdInput].forEach(function (f) {
            f.classList.remove('is-error');
        });
    }

    function fieldError(input, message) {
        input.classList.add('is-error');
        showAlert('error', message);
        try { input.focus(); } catch (e) { }
    }

    function setBusy(busy, label) {
        if (!authUI) return;
        var btn = authUI.submitBtn;
        btn.disabled = !!busy;
        btn.innerHTML = busy
            ? '<span class="vnc-spin"></span><span>' + (label || 'Veuillez patienter…') + '</span>'
            : '<span>' + (label || 'Continuer') + '</span>';
        if (!busy) {
            var texts = { signin: 'Se connecter', signup: 'Créer mon compte', recover: 'Envoyer le lien', 'update-password': 'Enregistrer le mot de passe' };
            btn.innerHTML = '<span>' + (texts[authMode] || 'Continuer') + '</span>';
        }
    }

    function showAuthScreen() {
        buildAuthUI();
        authUI.overlay.classList.remove('vnc-hidden');
        var syncOverlay = document.getElementById('sync-overlay');
        if (syncOverlay) syncOverlay.style.display = 'none';
    }

    function hideAuthScreen() {
        if (authUI) authUI.overlay.classList.add('vnc-hidden');
    }

    /* ------------------------------------------------------------------ */
    /*  Soumission du formulaire                                          */
    /* ------------------------------------------------------------------ */
    async function onSubmit(ev) {
        ev.preventDefault();
        if (!sb) { showAlert('error', 'Service indisponible, rechargez la page.'); return; }
        hideAlert();
        clearFieldError();

        var email = authUI.emailInput.value.trim();
        var pwd = authUI.pwdInput.value;

        // Mode « nouveau mot de passe » : l'e-mail n'est pas saisi par l'utilisateur
        // (session de récupération déjà authentifiée), on ne le valide donc pas.
        if (authMode === 'update-password') {
            if (pwd.length < 6) return fieldError(authUI.pwdInput, 'Le mot de passe doit contenir au moins 6 caractères.');
            if (passwordScore(pwd) < 2) return fieldError(authUI.pwdInput, 'Mot de passe trop simple : ajoutez des chiffres ou des majuscules.');
            if (authUI.cPwdInput.value !== pwd) return fieldError(authUI.cPwdInput, 'Les deux mots de passe ne correspondent pas.');
            return runUpdatePassword(pwd);
        }

        if (authMode === 'recover') {
            if (!isValidEmail(email)) return fieldError(authUI.emailInput, 'Merci de saisir une adresse e-mail valide.');
            return runRecover(email);
        }

        if (!isValidEmail(email)) return fieldError(authUI.emailInput, 'Merci de saisir une adresse e-mail valide.');

        if (authMode === 'signup') {
            var name = authUI.nameInput.value.trim();
            if (name.length < 2) return fieldError(authUI.nameInput, 'Indiquez votre nom (2 caractères minimum).');
            if (pwd.length < 6) return fieldError(authUI.pwdInput, 'Le mot de passe doit contenir au moins 6 caractères.');
            if (passwordScore(pwd) < 2) return fieldError(authUI.pwdInput, 'Mot de passe trop simple : ajoutez des chiffres ou des majuscules.');
            if (authUI.cPwdInput.value !== pwd) return fieldError(authUI.cPwdInput, 'Les deux mots de passe ne correspondent pas.');
            if (!authUI.termsInput.checked) { showAlert('error', 'Merci de cocher la case pour accepter le stockage sécurisé de vos données.'); return; }
            return runSignUp(email, pwd, name);
        }

        if (!pwd) return fieldError(authUI.pwdInput, 'Saisissez votre mot de passe.');
        return runSignIn(email, pwd);
    }

    async function runSignIn(email, pwd) {
        setBusy(true, 'Connexion…');
        try {
            var res = await sb.auth.signInWithPassword({ email: email, password: pwd });
            if (res.error) throw res.error;
            onAuthenticated(res.data.session, res.data.user);
        } catch (err) {
            var msg = translateAuthError(err);
            if ((err && err.code === 'email_not_confirmed') || /not confirmed/i.test(msg)) {
                showAlert('error', "Votre e-mail n'est pas encore confirmé. Vérifiez votre boîte de réception (et les spams).");
            } else {
                showAlert('error', msg);
            }
            authUI.pwdInput.classList.add('is-error');
        } finally {
            setBusy(false);
        }
    }

    async function runSignUp(email, pwd, name) {
        setBusy(true, 'Création du compte…');
        try {
            var res = await sb.auth.signUp({
                email: email,
                password: pwd,
                options: {
                    data: { full_name: name },
                    emailRedirectTo: window.location.origin + window.location.pathname
                }
            });
            if (res.error) throw res.error;

            if (res.data.session) {
                toast('Bienvenue ' + name + ' ! Votre espace est prêt.', 'success');
                onAuthenticated(res.data.session, res.data.user);
            } else {
                showAlert('success', 'Compte créé ! Vérifiez votre boîte e-mail pour confirmer votre adresse, puis connectez-vous.');
                setAuthMode('signin');
                authUI.emailInput.value = email;
            }
        } catch (err) {
            showAlert('error', translateAuthError(err));
        } finally {
            setBusy(false);
        }
    }

    async function runRecover(email) {
        setBusy(true, 'Envoi du lien…');
        try {
            var res = await sb.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + window.location.pathname
            });
            if (res.error) throw res.error;
            showAlert('success', 'Si un compte existe pour ' + email + ', un e-mail de réinitialisation vient d’être envoyé. Pensez à vérifier vos spams.');
        } catch (err) {
            showAlert('error', translateAuthError(err));
        } finally {
            setBusy(false);
        }
    }

    async function runUpdatePassword(pwd) {
        setBusy(true, 'Enregistrement…');
        try {
            var res = await sb.auth.updateUser({ password: pwd });
            if (res.error) throw res.error;
            showAlert('success', 'Mot de passe mis à jour. Vous pouvez continuer.');
            setTimeout(function () { onAuthenticated(session, user); }, 900);
        } catch (err) {
            showAlert('error', translateAuthError(err));
        } finally {
            setBusy(false);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Cycle de vie de la session                                        */
    /* ------------------------------------------------------------------ */
    function onAuthenticated(sess, usr) {
        session = sess || session;
        user = usr || (session && session.user) || user;
        if (!user) return;
        hideAuthScreen();
        if (loginResolve) {
            var r = loginResolve; loginResolve = null; r(true);
        }
    }

    async function loadProfile() {
        if (!user) return null;
        try {
            var res = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
            if (res.error) throw res.error;
            profile = res.data || null;
        } catch (e) {
            console.warn('[VN Cloud] profil indisponible:', e && e.message);
            profile = null;
        }
        return profile;
    }

    function displayName() {
        if (profile && profile.full_name) return profile.full_name;
        if (user && user.user_metadata && user.user_metadata.full_name) return user.user_metadata.full_name;
        return (user && user.email ? user.email.split('@')[0] : 'Utilisateur');
    }

    async function signOut() {
        try { await pushNow(true); } catch (e) { }
        try { if (realtimeChannel) await sb.removeChannel(realtimeChannel); } catch (e) { }
        try { await sb.auth.signOut(); } catch (e) { }
        // Purge des données locales pour éviter tout mélange entre comptes
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(ARCHIVE_KEY);
            localStorage.removeItem('vn-last-user');
            sessionStorage.setItem('vn-force-clean', '1');
        } catch (e) { }
        session = null; user = null; profile = null; knownRevision = 0; initializedRemote = false;
        booted = false;
        window.location.reload();
    }

    /* ------------------------------------------------------------------ */
    /*  Synchronisation                                                   */
    /* ------------------------------------------------------------------ */
    function getAppState() {
        if (window.VN_APP && typeof window.VN_APP.getState === 'function') {
            try { return window.VN_APP.getState(); } catch (e) { }
        }
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    function getAppArchive() {
        if (window.VN_APP && typeof window.VN_APP.getArchive === 'function') {
            try { return window.VN_APP.getArchive(); } catch (e) { }
        }
        try {
            var raw = localStorage.getItem(ARCHIVE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }

    function setSyncStatus(state, label) {
        var pill = document.getElementById('vnc-sync-pill');
        if (!pill) return;
        pill.className = 'vnc-sync' + (state ? ' ' + state : '');
        var txt = pill.querySelector('.vnc-sync-label');
        if (txt) txt.textContent = label || 'Synchronisé';
        pill.title = label || '';
    }

    /**
     * Récupère l'espace de travail distant.
     * @returns {Promise<object|null>}
     */
    async function fetchRemote() {
        if (!sb || !user) return null;
        var res = await sb.from('workspaces')
            .select('user_id,data,archive,revision,initialized,updated_at')
            .eq('user_id', user.id)
            .maybeSingle();
        if (res.error) throw res.error;
        return res.data || null;
    }

    /**
     * Hydratation : charge les données du cloud dans le stockage local avant
     * le démarrage de l'application.
     */
    async function hydrate() {
        try {
            // Isolation des comptes : si un autre utilisateur s'est connecté sur
            // ce navigateur (ou après une déconnexion), on repart d'une base vide.
            var forceClean = false;
            try {
                forceClean = sessionStorage.getItem('vn-force-clean') === '1';
                if (forceClean) sessionStorage.removeItem('vn-force-clean');
            } catch (e) { }

            var lastUser = null;
            try { lastUser = localStorage.getItem('vn-last-user'); } catch (e) { }

            var row = await fetchRemote();

            if (!row) {
                // Sécurité : le trigger a peut-être échoué → on crée la ligne.
                var ins = await sb.from('workspaces')
                    .insert({ user_id: user.id, data: {}, archive: [], initialized: false })
                    .select('user_id,data,archive,revision,initialized')
                    .single();
                if (ins.error) throw ins.error;
                row = ins.data;
            }

            knownRevision = row.revision || 0;
            initializedRemote = !!row.initialized;

            var hasRemoteData = row.initialized && row.data && typeof row.data === 'object' &&
                (Array.isArray(row.data.cards) || Array.isArray(row.data.columns));

            var foreignLocal = forceClean || (lastUser && lastUser !== user.id);

            if (hasRemoteData) {
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(row.data));
                    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(row.archive || []));
                } catch (e) {
                    console.warn('[VN Cloud] écriture locale impossible:', e);
                }
                localSnapshotSource = 'cloud';
            } else {
                if (foreignLocal) {
                    // Données d'un autre compte : on ne les importe jamais.
                    try {
                        localStorage.removeItem(STORAGE_KEY);
                        localStorage.removeItem(ARCHIVE_KEY);
                    } catch (e) { }
                    pendingMigration = null;
                } else {
                    // Premier passage de CET utilisateur : on migre ses données locales.
                    var localRaw = null;
                    try { localRaw = localStorage.getItem(STORAGE_KEY); } catch (e) { }
                    if (localRaw) {
                        try {
                            pendingMigration = JSON.parse(localRaw);
                        } catch (e) { pendingMigration = null; }
                    }
                }
            }

            try { localStorage.setItem('vn-last-user', user.id); } catch (e) { }
        } catch (err) {
            console.error('[VN Cloud] hydratation échouée:', err);
            toast('Synchronisation indisponible — mode local activé', 'error');
            setSyncStatus('err', 'Hors ligne');
        }
    }

    var pendingMigration = null;
    var localSnapshotSource = 'local';

    async function pushNow(immediate) {
        if (!sb || !user || applyingRemote) return;
        var state = getAppState();
        if (!state || !Array.isArray(state.cards)) return;

        if (pushInFlight) { pushPending = true; return; }
        pushInFlight = true;
        setSyncStatus('work', 'Synchronisation…');

        try {
            var payload = {
                user_id: user.id,
                data: state,
                archive: getAppArchive() || [],
                initialized: true,
                revision: knownRevision + 1,
                device_label: navigator.platform || 'web'
            };
            var res = await sb.from('workspaces').upsert(payload, { onConflict: 'user_id' }).select('revision');
            if (res.error) throw res.error;
            knownRevision = (res.data && res.data[0] && res.data[0].revision) || payload.revision;
            lastPushAt = Date.now();
            retryDelay = 2000;
            setSyncStatus('ok', 'Synchronisé');
            pendingMigration = null;
        } catch (err) {
            console.warn('[VN Cloud] envoi impossible:', err && (err.message || err));
            setSyncStatus('err', navigator.onLine ? 'Erreur sync' : 'Hors ligne');
            schedulePush(immediate ? 4000 : retryDelay);
            retryDelay = Math.min(retryDelay * 2, 60000);
        } finally {
            pushInFlight = false;
            if (pushPending) { pushPending = false; schedulePush(300); }
        }
    }

    var lastPushAt = 0;

    function schedulePush(delay) {
        if (pushTimer) clearTimeout(pushTimer);
        pushTimer = setTimeout(function () {
            pushTimer = null;
            pushNow();
        }, typeof delay === 'number' ? delay : 900);
    }

    /**
     * Applique une mise à jour distante (autre appareil / autre onglet).
     */
    function applyRemoteRow(row) {
        if (!row || !row.data) return;
        applyingRemote = true;
        try {
            knownRevision = Math.max(knownRevision, row.revision || 0);
            initializedRemote = !!row.initialized;

            localStorage.setItem(STORAGE_KEY, JSON.stringify(row.data));
            localStorage.setItem(ARCHIVE_KEY, JSON.stringify(row.archive || []));

            if (window.VN_APP && typeof window.VN_APP.setState === 'function') {
                window.VN_APP.setState(row.data);
                window.VN_APP.setArchive(row.archive || []);
                if (typeof window.VN_APP.rerender === 'function') window.VN_APP.rerender();
                toast('Mis à jour depuis un autre appareil ✨');
            } else {
                window.location.reload();
            }
            setSyncStatus('ok', 'Synchronisé');
        } catch (e) {
            console.warn('[VN Cloud] application distante impossible:', e);
        } finally {
            setTimeout(function () { applyingRemote = false; }, 400);
        }
    }

    async function pullLatest(silent) {
        try {
            var row = await fetchRemote();
            if (!row) return;
            if ((row.revision || 0) > knownRevision) {
                applyRemoteRow(row);
            } else if (!silent) {
                setSyncStatus('ok', 'À jour');
            }
            lastPullAt = Date.now();
        } catch (e) {
            if (!silent) console.warn('[VN Cloud] rafraîchissement impossible:', e && e.message);
        }
    }

    function subscribeRealtime() {
        if (!sb || !user) return;
        try {
            if (realtimeChannel) sb.removeChannel(realtimeChannel);
            realtimeChannel = sb.channel('vn-workspace-' + user.id, {
                config: { broadcast: { self: false } }
            });
            realtimeChannel
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'workspaces',
                    filter: 'user_id=eq.' + user.id
                }, function (payload) {
                    var row = payload && payload.new;
                    if (!row) return;
                    if ((row.revision || 0) <= knownRevision) return; // notre propre écriture
                    if (Date.now() - lastPushAt < 1500 && (row.revision || 0) === knownRevision + 1) {
                        knownRevision = row.revision;
                        return;
                    }
                    applyRemoteRow(row);
                })
                .subscribe(function (status) {
                    if (status === 'SUBSCRIBED') setSyncStatus('ok', 'Temps réel actif');
                });
        } catch (e) {
            console.warn('[VN Cloud] temps réel indisponible:', e);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Interface : chip de compte, badge de sync                         */
    /* ------------------------------------------------------------------ */
    function buildAccountUI() {
        injectStyles();
        var actions = document.querySelector('.header-actions');
        if (!actions || document.getElementById('vnc-account')) return;

        var pill = el('div', { class: 'vnc-sync ok', id: 'vnc-sync-pill', title: 'Synchronisation Supabase' }, [
            el('span', { class: 'vnc-sdot' }),
            el('span', { class: 'vnc-sync-label', text: 'Synchronisé' })
        ]);

        var wrap = el('div', { class: 'vnc-account', id: 'vnc-account' });
        var av = el('button', { class: 'vnc-avatar', id: 'vnc-avatar', type: 'button', title: 'Mon compte', 'aria-haspopup': 'true' }, [
            el('span', { class: 'vnc-ini', text: initials(user && user.email, displayName()) }),
            el('span', { class: 'vnc-mail', text: user ? user.email : 'Compte' })
        ]);

        var menu = el('div', { class: 'vnc-menu', id: 'vnc-menu', role: 'menu' }, [
            el('div', { class: 'vnc-menu-head' }, [
                el('strong', { text: displayName() }),
                el('span', { text: user ? user.email : '' })
            ])
        ]);

        var itemSync = el('button', { class: 'vnc-menu-item', type: 'button', html: I.sync + '<span>Synchroniser maintenant</span>' });
        itemSync.addEventListener('click', async function () {
            closeMenu();
            setSyncStatus('work', 'Synchronisation…');
            await pushNow(true);
            await pullLatest(true);
            setSyncStatus('ok', 'Synchronisé');
            toast('Synchronisé avec Supabase', 'success');
        });
        menu.appendChild(itemSync);

        var itemPwd = el('button', { class: 'vnc-menu-item', type: 'button', html: I.key + '<span>Changer mon mot de passe</span>' });
        itemPwd.addEventListener('click', function () { closeMenu(); showChangePassword(); });
        menu.appendChild(itemPwd);

        var itemOut = el('button', { class: 'vnc-menu-item danger', type: 'button', html: I.logout + '<span>Se déconnecter</span>' });
        itemOut.addEventListener('click', async function () {
            closeMenu();
            if (!confirm('Se déconnecter ? Vos données restent enregistrées dans votre espace cloud.')) return;
            await signOut();
        });
        menu.appendChild(itemOut);

        wrap.appendChild(av);
        wrap.appendChild(menu);

        actions.insertBefore(pill, actions.firstChild);
        actions.insertBefore(wrap, actions.firstChild);

        av.addEventListener('click', function (e) {
            e.stopPropagation();
            menu.classList.toggle('open');
        });
        document.addEventListener('click', function (e) {
            if (!wrap.contains(e.target)) closeMenu();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeMenu();
        });

        // Remplace le bouton « Sync » (dossier local) par la synchro cloud
        Array.prototype.forEach.call(document.querySelectorAll('.header-actions .btn'), function (btn) {
            var oc = btn.getAttribute('onclick') || '';
            if (oc.indexOf('selectRootFolder') >= 0) {
                btn.setAttribute('onclick', 'VN_CLOUD.syncNow()');
                btn.title = 'Synchroniser avec Supabase';
                btn.setAttribute('aria-label', 'Synchroniser avec Supabase');
                btn.innerHTML = I.sync.replace('<svg', '<svg width="15" height="15" style="vertical-align:-3px;margin-right:5px"') + 'Sync';
            }
        });
    }

    function closeMenu() {
        var m = document.getElementById('vnc-menu');
        if (m) m.classList.remove('open');
    }

    function showChangePassword() {
        // Réutilise l'écran d'authentification en mode « nouveau mot de passe ».
        buildAuthUI();
        authUI.overlay.classList.remove('vnc-hidden');
        authUI.tabs.style.display = 'none';
        setAuthMode('update-password');
        authUI.emailInput.value = user ? user.email : '';
        authUI.emailInput.disabled = true;
        authUI.fName.style.display = 'none';
        authUI.title.textContent = 'Changer mon mot de passe';
        authUI.subtitle.textContent = 'Saisissez un nouveau mot de passe pour ' + (user ? user.email : '') + '.';
        authUI.submitBtn.querySelector('span').textContent = 'Enregistrer';
        authUI.backBtn.textContent = '← Annuler';
        authUI.backBtn.onclick = function () {
            authUI.emailInput.disabled = false;
            hideAuthScreen();
        };
    }

    /* ------------------------------------------------------------------ */
    /*  Point d'entrée                                                    */
    /* ------------------------------------------------------------------ */
    function createClient() {
        if (!SUPABASE_KEY) {
            console.error('[VN Cloud] Clé publique Supabase manquante.');
            return null;
        }
        if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
            console.error('[VN Cloud] Bibliothèque supabase-js introuvable.');
            return null;
        }
        return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                storageKey: 'vn-auth-token',
                flowType: 'pkce'
            },
            realtime: { params: { eventsPerSecond: 5 } }
        });
    }

    function showBootScreen(label) {
        if (document.getElementById('vnc-boot')) return;
        injectStyles();
        var b = el('div', { class: 'vnc-boot', id: 'vnc-boot' }, [
            el('div', { class: 'vnc-spin2' }),
            el('span', { text: label || 'Chargement de votre espace…' })
        ]);
        document.body.appendChild(b);
    }

    function hideBootScreen() {
        var b = document.getElementById('vnc-boot');
        if (b) b.remove();
    }

    /**
     * Récupération de mot de passe : les liens e-mail de Supabase renvoient les
     * jetons dans le fragment d'URL. On les consomme explicitement pour être
     * compatible avec les deux flux (implicite et PKCE).
     */
    var recoveryLinkDetected = false;

    async function consumeUrlSession() {
        var hash = window.location.hash || '';
        var search = window.location.search || '';

        // Lien expiré / invalide
        var errMatch = /(?:^|[#&?])error(_description)?=([^&]*)/.exec(hash + search);
        if (errMatch && errMatch[2]) {
            var desc = decodeURIComponent(errMatch[2].replace(/\+/g, ' '));
            setTimeout(function () {
                showAuthScreen();
                showAlert('error', 'Ce lien n’est plus valide (' + desc + '). Demandez un nouvel e-mail de réinitialisation.');
            }, 400);
            try { history.replaceState(null, '', window.location.pathname); } catch (e) { }
            return null;
        }

        if (hash.indexOf('access_token=') === -1) return null;

        var params = new URLSearchParams(hash.replace(/^#/, ''));
        var access = params.get('access_token');
        var refresh = params.get('refresh_token');
        var type = params.get('type');
        if (!access) return null;

        try {
            var res = await sb.auth.setSession({ access_token: access, refresh_token: refresh || '' });
            if (res.error) throw res.error;
            session = res.data.session;
            user = res.data.user;
            recoveryLinkDetected = (type === 'recovery');
            try {
                history.replaceState(null, '', window.location.pathname + window.location.search);
            } catch (e) { }
            return session;
        } catch (error) {
            console.warn('[VN Cloud] lien de session invalide :', error && error.message);
            return null;
        }
    }

    /**
     * Authentifie l'utilisateur. Résout `true` quand une session est active.
     * C'est le point de blocage du démarrage de l'application.
     */
    async function authenticate() {
        showBootScreen('Connexion sécurisée…');
        sb = createClient();
        if (!sb) {
            hideBootScreen();
            showAuthScreen();
            showAlert('error', 'Configuration Supabase introuvable. Contactez l’administrateur.');
            return false;
        }

        // Lien de récupération de mot de passe ?
        var hash = window.location.hash || '';
        var isRecovery = /type=recovery/.test(hash) || /type=recovery/.test(window.location.search);

        var urlSession = await consumeUrlSession();
        if (urlSession) {
            session = session || urlSession;
            if (recoveryLinkDetected) {
                hideBootScreen();
                showAuthScreen();
                buildAuthUI();
                authUI.tabs.style.display = 'none';
                setAuthMode('update-password');
                authUI.emailInput.value = (user && user.email) || '';
                authUI.emailInput.disabled = true;
                showAlert('info', 'Lien vérifié. Choisissez maintenant votre nouveau mot de passe.');
                return new Promise(function (resolve) { loginResolve = resolve; });
            }
        }

        var getSess = await sb.auth.getSession();
        var existing = getSess && getSess.data ? getSess.data.session : null;

        if (isRecovery) {
            hideBootScreen();
            showAuthScreen();
            buildAuthUI();
            authUI.tabs.style.display = 'none';
            setAuthMode('update-password');
            authUI.emailInput.value = (existing && existing.user && existing.user.email) || '';
            authUI.emailInput.disabled = true;
            if (!existing) {
                showAlert('info', "Lien de réinitialisation en cours de vérification… Si rien ne se passe, demandez un nouveau lien.");
            }
            return new Promise(function (resolve) {
                loginResolve = resolve;
                var stop = sb.auth.onAuthStateChange(function (event, s) {
                    if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && s) {
                        session = s; user = s.user;
                    }
                });
                void stop;
            });
        }

        if (existing) {
            session = existing;
            user = existing.user;
            hideBootScreen();
            hideAuthScreen();
            await loadProfile();
            return true;
        }

        hideBootScreen();
        showAuthScreen();
        return new Promise(function (resolve) {
            loginResolve = resolve;
        });
    }

    function startSync() {
        booted = true;
        buildAccountUI();
        subscribeRealtime();
        updateServerDot(true);

        // Interception des sauvegardes de l'application → envoi cloud (débouncé)
        ['saveState', 'saveArchive'].forEach(function (fnName) {
            var original = window[fnName];
            if (typeof original !== 'function' || original.__vnWrapped) return;
            var wrapped = function () {
                var res = original.apply(this, arguments);
                if (!applyingRemote && user) schedulePush(900);
                return res;
            };
            wrapped.__vnWrapped = true;
            window[fnName] = wrapped;
        });

        // Migrations locales → cloud au premier passage
        if (pendingMigration && user) {
            setTimeout(function () {
                toast('Vos données locales ont été importées dans votre compte ✓', 'success');
                schedulePush(200);
            }, 1200);
        }

        // Reprise après perte réseau
        window.addEventListener('online', function () {
            setSyncStatus('work', 'Reconnexion…');
            schedulePush(300);
            pullLatest(true);
        });
        window.addEventListener('offline', function () {
            setSyncStatus('err', 'Hors ligne');
        });

        // Rafraîchissement au retour sur l'onglet
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden && user) pullLatest(true);
        });
        setInterval(function () {
            if (!document.hidden && user) pullLatest(true);
        }, 60000);

        // Envoi de secours avant fermeture
        window.addEventListener('beforeunload', function () {
            if (user && pushTimer) {
                try {
                    navigator.sendBeacon && navigator.sendBeacon(window.location.href, '');
                } catch (e) { }
            }
        });

        console.log('%c[VN Cloud] Synchronisation active', 'color:#0071E3;font-weight:bold', user && user.email);
    }

    function updateServerDot(ok) {
        var dot = document.getElementById('vnc-dot');
        if (dot) dot.className = 'vnc-dot' + (ok ? '' : ' off');
    }

    /* ------------------------------------------------------------------ */
    /*  API publique                                                      */
    /* ------------------------------------------------------------------ */
    window.VN_CLOUD = {
        get user() { return user; },
        get session() { return session; },
        get client() { return sb; },
        get revision() { return knownRevision; },
        authenticate: authenticate,
        hydrate: hydrate,
        startSync: startSync,
        signOut: signOut,
        signIn: function (email, pwd) { return runSignIn(email, pwd); },
        signUp: function (email, pwd, name) { return runSignUp(email, pwd, name); },
        showLogin: showAuthScreen,
        syncNow: async function () {
            setSyncStatus('work', 'Synchronisation…');
            await pushNow(true);
            await pullLatest(true);
            setSyncStatus('ok', 'Synchronisé');
            if (typeof window.showToast === 'function') window.showToast('Synchronisé avec Supabase ⚡');
        },
        pull: function () { return pullLatest(); },
        push: function () { return pushNow(true); },
        get profile() { return profile; },
        refreshProfile: function () { return loadProfile().then(buildAccountUI); }
    };
})();
