
        // =========== DATA STRUCTURE ============
        const STORAGE_KEY = 'kanban-data:' + window.vnUserId;
        const ARCHIVE_KEY = 'kanban-archive:' + window.vnUserId;
        const DATA_VERSION = 8;
        // Base de données fournie avec ce fichier : utilisée si aucun dossier Root
        // n'est encore connecté, ou si kanban-data.json / kanban-archive.json sont
        // servis à côté du HTML.
        const EMBEDDED_KANBAN_DATA = {"version":8,"columns":[{"id":1,"title":"Hier","color":"#FF9500"},{"id":2,"title":"Aujourd'hui","color":"#0071E3"},{"id":3,"title":"Dans la semaine","color":"#5856D6"},{"id":4,"title":"Mois prochain","color":"#AF52DE"},{"id":5,"title":"Terminé","color":"#34C759"}],"cards":[],"notes":[],"nextNoteId":1,"nextColumnId":6,"nextCardId":1};
        const EMBEDDED_KANBAN_ARCHIVE = [];
        let bootSource = null;

        let currentView = 'board';
        let currentCalendarDate = new Date();
        let currentDayDate = new Date();
        const DAY_HOUR_HEIGHT = 64;
        const DAY_START_HOUR = 0;
        const DAY_END_HOUR = 23;

        let state = {
            columns: [],
            cards: [],
            notes: [],
            nextColumnId: 1,
            nextCardId: 1,
            nextNoteId: 1
        };

        let archive = [];
        let priorityLabels = { high: 'Haute', medium: 'Moyenne', low: 'Basse' };

        // =========== ICONS (inline SVG) ============
        const icons = {
            calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
            clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
            timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="9"/><path d="M12 8v5l3 2M12 2v2"/></svg>',
            alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
            checklist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v6a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>',
            note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>'
        };
        // Icônes charte pour la vue Journée (trait 1.5, coins arrondis)
        const dayIcons = {
            sunrise: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 18a5 5 0 00-10 0"/><path d="M12 2v6M4.2 10.2l1.4 1.4M2 18h2M20 18h2M18.4 11.6l1.4-1.4M22 22H2"/><path d="M8 6l4-4 4 4"/></svg>',
            sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
            moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>',
            wave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11a3 3 0 106 0"/><path d="M3 19c1.5-2 3.5-3 6-3s4.5 1 6 3"/><circle cx="12" cy="6" r="2"/></svg>',
            checkCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>',
            alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
            calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h3"/></svg>',
            plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>'
        };

        // =========== TIMER SYSTEM ============
        let activeTimers = {};
        let timerIntervals = {};
        let timerTicker = null;

        /**
         * Ticker unique de secours : tant qu'au moins un chrono tourne, il
         * rafraîchit l'affichage chaque seconde. Ainsi, même si un intervalle
         * par carte est perdu (re-rendu, synchro, onglet en arrière-plan…),
         * les secondes continuent d'avancer.
         */
                function ensureTimerTicker() {
            if (timerTicker) return;
            timerTicker = setInterval(() => {
                const ids = Object.keys(activeTimers).map(Number).filter(id => isTimerRunning(id));
                if (ids.length === 0) {
                    clearInterval(timerTicker);
                    timerTicker = null;
                    return;
                }
                requestAnimationFrame(() => {
                    ids.forEach(id => updateTimerDisplay(id));
                });
            }, 1000);
        }



        function startTimer(cardId, event) {
            if (event) event.stopPropagation();
            const card = state.cards.find(c => c.id === cardId);
            if (!card) return;
            const col = state.columns.find(c => c.id === card.columnId);
            if (isCompletedColumn(col)) {
                showToast('Impossible de démarrer un chronomètre sur une tâche terminée');
                return;
            }
            if (!card.timeHistory) card.timeHistory = [];
            if (!card.totalTimeSpent) card.totalTimeSpent = 0;

            if (activeTimers[cardId]) {
                activeTimers[cardId].startTime = Date.now();
            } else {
                activeTimers[cardId] = { startTime: Date.now(), elapsed: 0 };
            }

            card.timeHistory.push({ type: 'play', timestamp: new Date().toISOString() });

            if (timerIntervals[cardId]) { clearInterval(timerIntervals[cardId]); delete timerIntervals[cardId]; }
            ensureTimerTicker();

            saveState();
            updateGlobalTimerBar();
            showToast('Chronomètre démarré');
        }

        function pauseTimer(cardId, event) {
            if (event) event.stopPropagation();
            const card = state.cards.find(c => c.id === cardId);
            if (!card || !activeTimers[cardId]) return;

            const now = Date.now();
            const sessionSeconds = Math.floor((now - activeTimers[cardId].startTime) / 1000);
            activeTimers[cardId].elapsed += sessionSeconds;

            card.timeHistory.push({ type: 'pause', timestamp: new Date().toISOString(), duration: sessionSeconds });
            card.totalTimeSpent += sessionSeconds;

            if (timerIntervals[cardId]) {
                clearInterval(timerIntervals[cardId]);
                delete timerIntervals[cardId];
            }
            activeTimers[cardId].startTime = null;

            saveState();
            updateGlobalTimerBar();
            showToast('Chronomètre en pause');
        }

        function stopTimer(cardId, event) {
            if (event) event.stopPropagation();
            const card = state.cards.find(c => c.id === cardId);
            if (!card) return;

            let sessionSeconds = 0;
            if (activeTimers[cardId]) {
                if (activeTimers[cardId].startTime) {
                    const now = Date.now();
                    sessionSeconds = Math.floor((now - activeTimers[cardId].startTime) / 1000);
                    activeTimers[cardId].elapsed += sessionSeconds;
                    card.totalTimeSpent += sessionSeconds;
                }
                if (!card.timeHistory) card.timeHistory = [];
                card.timeHistory.push({ type: 'stop', timestamp: new Date().toISOString(), duration: activeTimers[cardId].elapsed });
                delete activeTimers[cardId];
            }

            if (timerIntervals[cardId]) {
                clearInterval(timerIntervals[cardId]);
                delete timerIntervals[cardId];
            }

            saveState();
            updateGlobalTimerBar();
            showToast('Chronomètre arrêté');
        }

        function stopAllTimers(event) {
            if (event) event.stopPropagation();
            const ids = Object.keys(activeTimers).map(Number);
            ids.forEach(id => stopTimer(id));
            showToast('Tous les chronomètres arrêtés');
        }

        function getTimerElapsed(cardId) {
            const timer = activeTimers[cardId];
            if (!timer) return 0;
            let elapsed = timer.elapsed || 0;
            if (timer.startTime) {
                elapsed += Math.floor((Date.now() - timer.startTime) / 1000);
            }
            return elapsed;
        }

        function isTimerRunning(cardId) {
            return activeTimers[cardId] && activeTimers[cardId].startTime !== null;
        }

        function isTimerPaused(cardId) {
            return activeTimers[cardId] && activeTimers[cardId].startTime === null;
        }

        function formatTime(totalSeconds) {
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            if (hours > 0) {
                return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
            }
            return `${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
        }

        function formatTimeCompact(totalSeconds) {
            if (totalSeconds < 60) return `${totalSeconds}s`;
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            if (hours > 0) return `${hours}h${minutes}`;
            return `${minutes}:${String(seconds).padStart(2, '0')}`;
        }

        // formatDuration defined below (line ~7653) to avoid duplicate

        /**
         * Calcule un chemin SVG "part de tarte" depuis l'angle startAngle vers endAngle
         * (angles en degrés, 0° = 3h du matin, donc -90° = midi/12h).
         * On tourne dans le sens horaire.
         */
        function pieSlicePath(cx, cy, r, startDeg, endDeg) {
            const start = (startDeg - 90) * Math.PI / 180;
            const end   = (endDeg   - 90) * Math.PI / 180;
            const x1 = cx + r * Math.cos(start);
            const y1 = cy + r * Math.sin(start);
            const x2 = cx + r * Math.cos(end);
            const y2 = cy + r * Math.sin(end);
            const largeArc = (endDeg - startDeg) > 180 ? 1 : 0;
            // M 32 32 = on part du centre ; L x1 y1 = ligne au bord ; A = arc ; Z = retour centre
            return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
        }

        /**
         * Format compact, conçu pour les deux métriques principales du timer.
         */
        function formatTimerMetric(totalSeconds) {
            const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
            if (seconds < 60) return `${seconds}s`;
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const remainSeconds = seconds % 60;
            if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}`;
            return `${minutes}:${String(remainSeconds).padStart(2, '0')}`;
        }

        /** État unique partagé entre le rendu initial et le rafraîchissement seconde par seconde. */
        function getTimerUiState(card, elapsed = getTimerElapsed(card.id)) {
            const running = isTimerRunning(card.id);
            const paused = isTimerPaused(card.id);
            const hasEstimate = !!(card.duration && Number(card.duration) > 0);
            const estimateSec = hasEstimate ? Number(card.duration) * 60 : 0;
            const totalSpent = card.totalTimeSpent || 0;
            let stateClass = 'state-idle';
            let status = 'Prêt';
            let rawRatio = 0;
            let visualRatio = 0;
            let overtime = false;

            if (hasEstimate) {
                rawRatio = estimateSec > 0 ? elapsed / estimateSec : 0;
                visualRatio = Math.min(Math.max(rawRatio, 0), 1);
                if (rawRatio >= 1) {
                    stateClass = 'state-red';
                    status = 'Dépassement';
                    overtime = true;
                } else if (running) {
                    if (rawRatio < 0.5) {
                        stateClass = 'state-green';
                        status = 'En cours';
                    } else if (rawRatio < 0.75) {
                        stateClass = 'state-amber';
                        status = 'À mi-parcours';
                    } else {
                        stateClass = 'state-orange';
                        status = 'Bientôt fini';
                    }
                } else if (paused) {
                    stateClass = 'state-paused';
                    status = 'En pause';
                } else if (elapsed > 0) {
                    stateClass = 'state-paused';
                    status = 'Interrompu';
                }
            } else {
                // Un chrono libre garde une boucle visuelle de 15 min, sans
                // prétendre indiquer une estimation inexistante.
                visualRatio = (elapsed % (15 * 60)) / (15 * 60);
                if (running) {
                    stateClass = 'state-green';
                    status = 'En cours';
                } else if (paused) {
                    stateClass = 'state-paused';
                    status = 'En pause';
                } else if (elapsed > 0 || totalSpent > 0) {
                    stateClass = 'state-paused';
                    status = 'Interrompu';
                }
            }

            return {
                elapsed,
                running,
                paused,
                hasEstimate,
                estimateSec,
                remaining: hasEstimate ? Math.max(0, estimateSec - elapsed) : null,
                stateClass,
                status,
                visualRatio,
                overtime
            };
        }

        /** Rend un anneau de progression fin plutôt que le camembert décoratif. */
        function renderTimerVisual(card, elapsedOverride = null) {
            const elapsed = elapsedOverride === null ? getTimerElapsed(card.id) : elapsedOverride;
            const ui = getTimerUiState(card, elapsed);
            const radius = 18;
            const circumference = 2 * Math.PI * radius;
            const dashOffset = circumference * (1 - ui.visualRatio);
            const label = ui.hasEstimate
                ? `Progression : ${Math.round(ui.visualRatio * 100)} % de l'estimation`
                : `Chronométrage ${ui.status.toLowerCase()}`;

            return `
                <div class="timer-visual timer-ring ${ui.stateClass} ${ui.running ? 'running' : ''} ${ui.overtime ? 'overtime' : ''}" role="img" aria-label="${label}" data-circumference="${circumference}">
                    <svg viewBox="0 0 48 48" aria-hidden="true">
                        <circle class="timer-ring-track" cx="24" cy="24" r="${radius}"/>
                        <circle class="timer-ring-progress" cx="24" cy="24" r="${radius}" style="stroke-dasharray:${circumference};stroke-dashoffset:${dashOffset};"/>
                    </svg>
                    <span class="timer-ring-center"></span>
                </div>`;
        }

        /** Met à jour les deux métriques, le statut et l'anneau sans re-rendre la carte. */
        function updateTimerDisplay(cardId) {
            const id = Number(cardId);
            const card = state.cards.find(c => c.id === id);
            if (!card) return;
            // Vue Jour : faire défiler le chrono live affiché à côté du bouton
            // play/pause des lignes de la journée, sans re-rendu complet.
            document.querySelectorAll(`.day-task-row[data-card-id="${id}"] .dtc-live`).forEach(el => {
                el.textContent = formatDayTimerClock(getTimerElapsed(id));
            });
            // FIX : ne cibler QUE la carte du board. `[data-card-id]` est aussi
            // utilisé par les lignes de la vue Jour (.day-task-row), qui sont
            // placées avant le board dans le DOM : querySelector renvoyait alors
            // la ligne de la vue Jour, sans métriques de chrono, et l'affichage
            // des secondes restait figé.
            const cardEls = Array.from(document.querySelectorAll(`.card[data-card-id="${id}"]`));
            if (cardEls.length === 0) { updateGlobalTimerBar(); return; }

            const ui = getTimerUiState(card);
            cardEls.forEach(cardEl => updateTimerDisplayIn(cardEl, card, ui));
            updateGlobalTimerBar();
        }

        /** Applique l'état du timer à un conteneur de carte donné. */
        function updateTimerDisplayIn(cardEl, card, ui) {
            const elapsedValue = cardEl.querySelector('.timer-elapsed-value');
            const remainingValue = cardEl.querySelector('.timer-remaining-value');
            const remainingLabel = cardEl.querySelector('.timer-remaining-label');
            const statusText = cardEl.querySelector('.timer-status-text');
            const experience = cardEl.querySelector('.timer-experience');
            const estimateText = cardEl.querySelector('.timer-estimate-text');

            if (elapsedValue) elapsedValue.textContent = formatTimerMetric(ui.elapsed);
            if (remainingValue) remainingValue.textContent = ui.hasEstimate ? formatTimerMetric(ui.remaining) : '—';
            if (remainingLabel) remainingLabel.textContent = ui.hasEstimate ? 'restant' : 'sans limite';
            if (statusText) statusText.textContent = ui.status;
            if (estimateText) {
                estimateText.textContent = ui.hasEstimate
                    ? `Estimation · ${formatDuration(card.duration)}`
                    : 'Sans estimation';
            }

            if (experience) {
                experience.classList.remove('state-green','state-amber','state-orange','state-red','state-paused','state-idle','is-running','is-overtime');
                experience.classList.add(ui.stateClass);
                if (ui.running) experience.classList.add('is-running');
                if (ui.overtime) experience.classList.add('is-overtime');
            }

            const ring = cardEl.querySelector('.timer-ring');
            if (ring) {
                const circumference = Number(ring.dataset.circumference) || (2 * Math.PI * 18);
                const progress = ring.querySelector('.timer-ring-progress');
                ring.classList.remove('state-green','state-amber','state-orange','state-red','state-paused','state-idle','running','overtime');
                ring.classList.add(ui.stateClass);
                if (ui.running) ring.classList.add('running');
                if (ui.overtime) ring.classList.add('overtime');
                ring.setAttribute('aria-label', ui.hasEstimate
                    ? `Progression : ${Math.round(ui.visualRatio * 100)} % de l'estimation`
                    : `Chronométrage ${ui.status.toLowerCase()}`);
                if (progress) progress.style.strokeDashoffset = String(circumference * (1 - ui.visualRatio));
            }
        }

        // La barre globale a été retirée : le suivi est désormais concentré
        // dans la carte de tâche et dans le raccourci du header. Les appels
        // existants restent sans effet pour préserver la logique des timers.
        function updateGlobalTimerBar() {}

        /**
         * Mise à jour CIBLÉE de l'état chrono des cartes Kanban : remplace le
         * renderBoard() complet qui reconstruisait toutes les colonnes et
         * faisait remonter le scroll en haut de chacune. On actualise ici,
         * en place : classes d'état de la carte, métriques/anneau (via
         * updateTimerDisplayIn), bouton principal play/pause et bouton
         * « Arrêter » (présent seulement quand un chrono existe).
         */
        function updateCardTimerUI(cardId) {
            const id = Number(cardId);
            const card = state.cards.find(c => c.id === id);
            if (!card) return;
            const ui = getTimerUiState(card);
            const hasTimer = activeTimers[id] !== undefined;
            const iconPause = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4.5" width="4" height="15" rx="1.2"/><rect x="14" y="4.5" width="4" height="15" rx="1.2"/></svg>';
            const iconPlay = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-left:2px;" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg>';
            document.querySelectorAll(`.card[data-card-id="${id}"]`).forEach(cardEl => {
                // 1. Classes d'état sur la racine de la carte
                cardEl.classList.toggle('timer-running', ui.running);
                cardEl.classList.toggle('timer-paused', ui.paused);
                // 2. Métriques, statut, anneau de progression
                updateTimerDisplayIn(cardEl, card, ui);
                // 3. Bouton principal play/pause
                const mainBtn = cardEl.querySelector('.timer-btn-v-play, .timer-btn-v-pause');
                if (mainBtn) {
                    mainBtn.classList.toggle('timer-btn-v-play', !ui.running);
                    mainBtn.classList.toggle('timer-btn-v-pause', ui.running);
                    mainBtn.setAttribute('onclick', ui.running ? `pauseTimer(${id}, event)` : `startTimer(${id}, event)`);
                    const title = ui.running ? 'Mettre en pause' : (hasTimer ? 'Reprendre' : 'Démarrer le chronomètre');
                    mainBtn.setAttribute('title', title);
                    mainBtn.setAttribute('aria-label', title);
                    mainBtn.innerHTML = ui.running ? iconPause : iconPlay;
                }
                // 4. Bouton « Arrêter » : apparaît au démarrage, disparaît à l'arrêt
                const stopBtn = cardEl.querySelector('.timer-stop-secondary');
                if (hasTimer && !stopBtn) {
                    const sub = cardEl.querySelector('.timer-row-sub');
                    if (sub) sub.insertAdjacentHTML('beforeend',
                        `<button class="timer-btn-v timer-btn-v-stop timer-stop-secondary" onclick="stopTimer(${id}, event)" title="Arrêter et enregistrer le temps" aria-label="Arrêter et enregistrer le temps">
                             <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2.5"/></svg><span>Arrêter</span>
                       </button>`);
                } else if (!hasTimer && stopBtn) {
                    stopBtn.remove();
                }
            });
        }

        // =========== INITIALIZATION & STORAGE ============
        let dirHandle = null;
        let dataFileHandle = null;
        let archiveFileHandle = null;
        let lastModifiedTime = 0;

        async function init() {
            try {
                const overlay = document.getElementById('sync-overlay');

                // RÉCUPÉRATION DES DONNÉES CONSERVÉE :
                // si le navigateur permet l'accès au système de fichiers, on demande
                // d'abord le dossier Root. C'est ce dossier qui contient la vraie base
                // kanban-data.json / kanban-archive.json et qui sert à la synchronisation.
                if (window.showDirectoryPicker) {
                    if (overlay) overlay.style.display = 'flex';
                    return;
                }

                // Fallback pour les environnements sans File System Access API
                // (prévisualisation sandbox, certains navigateurs mobiles, etc.).
                if (overlay) overlay.style.display = 'none';
                let loaded = false;
                try {
                    if (localStorage.getItem(STORAGE_KEY)) {
                        loadStateLocal();
                        loaded = true;
                        bootSource = 'base locale';
                    }
                } catch (storageError) {
                    console.warn('Lecture localStorage impossible:', storageError);
                }
                if (!loaded) loaded = await tryLoadBundledDatabase();
                if (!loaded) loadStateLocal();
                startApp();
                if (loaded && bootSource !== 'base locale') saveArchive();
                setTimeout(() => showToast(`Base chargée : ${bootSource || 'base locale'}`), 700);
            } catch (error) {
                console.error('Erreur initialisation:', error);
                showToast('Erreur lors du chargement');
                loadStateLocal();
                startApp();
            }
        }

        async function startWithoutRoot() {
            const overlay = document.getElementById('sync-overlay');
            if (overlay) overlay.style.display = 'none';
            try {
                // Continuer sans dossier ne supprime pas la récupération Root :
                // c'est seulement un fallback manuel si l'utilisateur ne veut pas
                // connecter le dossier maintenant.
                let loaded = false;
                try {
                    if (localStorage.getItem(STORAGE_KEY)) {
                        loadStateLocal();
                        loaded = true;
                        bootSource = 'base locale';
                    }
                } catch (storageError) {
                    console.warn('Lecture localStorage impossible:', storageError);
                }
                if (!loaded) loaded = await tryLoadBundledDatabase();
                if (!loaded) loadStateLocal();
                startApp();
                if (loaded && bootSource !== 'base locale') saveArchive();
                setTimeout(() => showToast(`Base chargée : ${bootSource || 'base locale'}`), 700);
            } catch (error) {
                console.error('Erreur chargement sans dossier:', error);
                loadStateLocal();
                startApp();
            }
        }

        function cloneData(obj) {
            return JSON.parse(JSON.stringify(obj));
        }

        function applyDatabasePayload(parsed, sourceLabel = 'base de données') {
            if (!parsed || typeof parsed !== 'object') return false;
            if (parsed.version === DATA_VERSION) {
                state = parsed;
                migrateLegacyColumns();
            } else if (!parsed.version || parsed.version < DATA_VERSION) {
                console.log(`Migration ${sourceLabel} v${parsed.version} → v${DATA_VERSION}`);
                state = migrateData(parsed);
                migrateLegacyColumns();
            } else {
                state = parsed;
                migrateLegacyColumns();
            }
            if (!Array.isArray(state.columns)) state.columns = [];
            if (!Array.isArray(state.cards)) state.cards = [];
            if (state.columns.length === 0) createDefaultColumns();
            normalizeNextIds();
            return true;
        }

        async function tryLoadBundledDatabase() {
            // Priorité au fichier JSON situé à côté du HTML (cas serveur / PWA / preview).
            try {
                // La sonde n'a de sens que servi par un serveur : en file:// elle
                // échoue toujours (CORS) et pollue la console.
                if (!/^https?:$/.test(location.protocol)) throw new Error('protocole local');
                const dataRes = await fetch('kanban-data.json', { cache: 'no-store' });
                if (dataRes && dataRes.ok) {
                    const parsed = await dataRes.json();
                    if (applyDatabasePayload(parsed, 'kanban-data.json')) {
                        try {
                            const archiveRes = await fetch('kanban-archive.json', { cache: 'no-store' });
                            if (archiveRes && archiveRes.ok) archive = await archiveRes.json();
                        } catch (archiveError) {
                            console.warn('Archive externe indisponible, archive embarquée utilisée:', archiveError);
                            archive = cloneData(EMBEDDED_KANBAN_ARCHIVE || []);
                        }
                        bootSource = 'kanban-data.json';
                        return true;
                    }
                }
            } catch (error) {
                console.info('Chargement direct de kanban-data.json impossible, fallback en cours:', error);
            }

            // Si aucun stockage local n'existe, utiliser la base embarquée fournie par l'utilisateur.
            // Cela permet au HTML de récupérer les informations sans dépendre du localStorage.
            try {
                if (!localStorage.getItem(STORAGE_KEY) && EMBEDDED_KANBAN_DATA) {
                    const ok = applyDatabasePayload(cloneData(EMBEDDED_KANBAN_DATA), 'base embarquée');
                    archive = cloneData(EMBEDDED_KANBAN_ARCHIVE || []);
                    bootSource = 'base embarquée';
                    return ok;
                }
            } catch (error) {
                console.warn('Fallback embarqué impossible:', error);
            }
            return false;
        }

        function normalizeNextIds() {
            const maxColumnId = Math.max(0, ...((state.columns || []).map(c => Number(c.id) || 0)));
            const maxCardId = Math.max(0, ...((state.cards || []).map(c => Number(c.id) || 0)));
            const maxNoteId = Math.max(0, ...((state.notes || []).map(n => Number(n.id) || 0)));
            state.nextColumnId = Math.max(Number(state.nextColumnId) || 1, maxColumnId + 1);
            state.nextCardId = Math.max(Number(state.nextCardId) || 1, maxCardId + 1);
            state.nextNoteId = Math.max(Number(state.nextNoteId) || 1, maxNoteId + 1);
        }

        function startApp() {
            console.log('DB chargée:', JSON.stringify(state).substring(0,300));
            normalizeNextIds();
            if (typeof ensureNotesState === 'function') ensureNotesState();
            ensureFutureColumns();
            // Migration: si une colonne Hier n'existe pas mais des tâches d'hier existent, elles seront routées
            autoRouteTasks();
            saveState();
            renderBoard();
            updateStats();
            animateStatsEntrance();
            console.log('App démarrée avec', state.columns.map(c=>c.title).join(' | '), 'et', state.cards.length, 'tâches');
            // Cloud synchronization replaces the old shared local/Root watcher.
            setInterval(() => {
                updateDeadlineAlerts();
                updateStats();
                updateGlobalTimerBar();
                autoRouteTasks();
                refreshNowFocusWidgets();
                // Synced by cloud.js.
            }, 30000);
        }

        function normalizeColumnTitle(title) {
            return (title || '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim();
        }

        function isCompletedColumn(col) {
            return col && normalizeColumnTitle(col.title) === 'termine';
        }

        function isTodayColumn(col) {
            if (!col) return false;
            const t = normalizeColumnTitle(col.title);
            return t === "aujourd'hui" || t === 'aujourdhui';
        }

        function isYesterdayColumn(col) {
            if (!col) return false;
            const t = normalizeColumnTitle(col.title);
            return t === 'hier';
        }

        function isWeekColumn(col) {
            if (!col) return false;
            const t = normalizeColumnTitle(col.title);
            return t === 'dans la semaine' || t === 'semaine prochaine' || t === 'demain';
        }

        function isNextMonthColumn(col) {
            if (!col) return false;
            const t = normalizeColumnTitle(col.title);
            return t === 'mois prochain' || t === 'le mois prochain';
        }

        // Compat alias
        function isTomorrowColumn(col) { return isWeekColumn(col); }

        function findColumnByRole(role) {
            if (role === 'today') {
                return state.columns.find(isTodayColumn) || state.columns[0];
            }
            if (role === 'yesterday') {
                return state.columns.find(isYesterdayColumn);
            }
            if (role === 'week' || role === 'tomorrow' || role === 'next-week') {
                return state.columns.find(isWeekColumn)
                    || state.columns.find(c => normalizeColumnTitle(c.title) === 'dans la semaine')
                    || state.columns.find(c => normalizeColumnTitle(c.title) === 'semaine prochaine');
            }
            if (role === 'next-month') {
                return state.columns.find(isNextMonthColumn)
                    || state.columns.find(c => normalizeColumnTitle(c.title) === 'mois prochain');
            }
            if (role === 'completed') {
                return state.columns.find(isCompletedColumn);
            }
            return null;
        }

        // =========== STAT / COLUMN COLOR SYNCHRONIZATION ============
        // Les filtres reprennent la couleur de la colonne qu'ils représentent.
        function getColumnStatColor(column, fallback) {
            const color = column && typeof column.color === 'string' ? column.color.trim() : '';
            return /^#[0-9a-f]{3,8}$/i.test(color) ? color : fallback;
        }

        function syncStatColors() {
            const bindings = [
                { type: 'yesterday', role: 'yesterday', fallback: '#FF9500' },
                { type: 'todo', role: 'today', fallback: '#0071E3' },
                { type: 'week', role: 'week', fallback: '#5856D6' },
                { type: 'next-month', role: 'next-month', fallback: '#AF52DE' },
                { type: 'completed', role: 'completed', fallback: '#34C759' },
                // En retard est un statut transversal : il conserve le rouge système.
                { type: 'overdue', role: null, fallback: 'var(--sys-red)' }
            ];

            bindings.forEach(({ type, role, fallback }) => {
                const item = document.querySelector(`.stat-item[data-stat-type="${type}"]`);
                if (!item) return;
                const color = role ? getColumnStatColor(findColumnByRole(role), fallback) : fallback;
                item.style.setProperty('--stat-color', color);
            });
        }

        function getYesterdayStr() {
            const d = new Date(); d.setDate(d.getDate()-1);
            return localDateStr(d);
        }

        function localDateStr(dateObj = new Date()) {
            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const d = String(dateObj.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }

        function parseLocalDate(dateStr) {
            if (!dateStr) return null;
            const parts = String(dateStr).split('-').map(Number);
            if (parts.length < 3 || parts.some(n => isNaN(n))) return null;
            const d = new Date(parts[0], parts[1] - 1, parts[2]);
            d.setHours(0, 0, 0, 0);
            return isNaN(d.getTime()) ? null : d;
        }

        function migrateLegacyColumns() {
            // Migration vers le système : Hier / Aujourd'hui / Dans la semaine / Mois prochain / Terminé
            state.columns.forEach(col => {
                const t = normalizeColumnTitle(col.title);
                if (t === 'a faire') {
                    col.title = "Aujourd'hui";
                    if (!col.color) col.color = '#0071E3';
                } else if (t === 'en cours' || t === 'demain') {
                    col.title = 'Dans la semaine';
                    col.color = col.color || '#5856D6';
                } else if (t === 'semaine prochaine') {
                    col.title = 'Dans la semaine';
                    col.color = col.color || '#5856D6';
                } else if (t === 'mois prochain' || t === 'le mois prochain') {
                    col.title = 'Mois prochain';
                    col.color = col.color || '#AF52DE';
                }
            });
            // Dédupliquer : garder une seule colonne "Dans la semaine"
            const weekCols = state.columns.filter(isWeekColumn);
            if (weekCols.length > 1) {
                const keep = weekCols[0];
                // déplacer les cartes des doublons vers keep
                weekCols.slice(1).forEach(dup => {
                    state.cards.forEach(c => { if (c.columnId === dup.id) c.columnId = keep.id; });
                });
                state.columns = state.columns.filter(c => !weekCols.slice(1).some(d => d.id === c.id));
            }
            // Dédupliquer : garder une seule colonne "Mois prochain"
            const nextMonthCols = state.columns.filter(isNextMonthColumn);
            if (nextMonthCols.length > 1) {
                const keep = nextMonthCols[0];
                nextMonthCols.slice(1).forEach(dup => {
                    state.cards.forEach(c => { if (c.columnId === dup.id) c.columnId = keep.id; });
                });
                state.columns = state.columns.filter(c => !nextMonthCols.slice(1).some(d => d.id === c.id));
            }
        }

        function ensureFutureColumns() {
            normalizeNextIds();
            migrateLegacyColumns();
            normalizeNextIds();

            let yCol = findColumnByRole('yesterday');
            if (!yCol) {
                yCol = { id: state.nextColumnId++, title: 'Hier', color: '#FF9500' };
                state.columns.unshift(yCol);
            }

            let todayCol = findColumnByRole('today');
            if (!todayCol) {
                todayCol = { id: state.nextColumnId++, title: "Aujourd'hui", color: '#0071E3' };
                const yIdx = state.columns.findIndex(c => c.id === yCol.id);
                state.columns.splice(Math.max(0, yIdx) + 1, 0, todayCol);
            }

            let weekCol = findColumnByRole('week');
            if (!weekCol) {
                weekCol = { id: state.nextColumnId++, title: 'Dans la semaine', color: '#5856D6' };
                const todayIdx = state.columns.findIndex(c => c.id === todayCol.id);
                state.columns.splice(Math.max(0, todayIdx) + 1, 0, weekCol);
            } else if (normalizeColumnTitle(weekCol.title) !== 'dans la semaine') {
                weekCol.title = 'Dans la semaine';
                weekCol.color = weekCol.color || '#5856D6';
            }

            let nextMonthCol = findColumnByRole('next-month');
            if (!nextMonthCol) {
                nextMonthCol = { id: state.nextColumnId++, title: 'Mois prochain', color: '#AF52DE' };
                const weekIdx = state.columns.findIndex(c => c.id === weekCol.id);
                state.columns.splice(Math.max(0, weekIdx) + 1, 0, nextMonthCol);
            } else {
                nextMonthCol.title = 'Mois prochain';
                nextMonthCol.color = nextMonthCol.color || '#AF52DE';
            }

            let termCol = findColumnByRole('completed');
            if (!termCol) {
                termCol = { id: state.nextColumnId++, title: 'Terminé', color: '#34C759' };
                state.columns.push(termCol);
            }

            // Ordonner : Hier, Aujourd'hui, Dans la semaine, Mois prochain, Terminé (+ éventuels customs avant Terminé)
            const order = { 'hier':0, "aujourd'hui":1, 'aujourdhui':1, 'dans la semaine':2, 'mois prochain':3, 'termine':99 };
            const customs = state.columns.filter(c => order[normalizeColumnTitle(c.title)] === undefined);
            const ordered = [];
            const y = state.columns.find(isYesterdayColumn);
            const t = state.columns.find(isTodayColumn);
            const w = state.columns.find(isWeekColumn);
            const m = state.columns.find(isNextMonthColumn);
            const comp = state.columns.find(isCompletedColumn);
            if (y) ordered.push(y);
            if (t) ordered.push(t);
            if (w) ordered.push(w);
            if (m) ordered.push(m);
            customs.forEach(c=>{ if(!ordered.includes(c) && !isCompletedColumn(c)) ordered.push(c); });
            if (comp) ordered.push(comp);
            // préserver colonnes inconnues sans doublon
            state.columns.forEach(c=>{ if(!ordered.includes(c)) ordered.push(c); });
            state.columns = ordered;
            normalizeNextIds();
        }

        function getTargetColumnForDate(dateStr) {
            // Automatisation des dates :
            // - passé/hier → Hier
            // - aujourd'hui → Aujourd'hui
            // - futur restant dans le mois courant → Dans la semaine
            // - à partir du 1er jour du mois suivant → Mois prochain
            if (!dateStr) return 'week';
            const taskDate = parseLocalDate(dateStr);
            if (!taskDate) return 'week';
            taskDate.setHours(0,0,0,0);
            const today = new Date(); today.setHours(0,0,0,0);
            const yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
            const firstDayNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
            firstDayNextMonth.setHours(0,0,0,0);
            if (taskDate.getTime() === today.getTime()) return 'today';
            if (taskDate.getTime() === yesterday.getTime()) return 'yesterday';
            if (taskDate.getTime() < today.getTime()) return 'yesterday'; // backlog ancien -> Hier
            if (taskDate.getTime() >= firstDayNextMonth.getTime()) return 'next-month';
            return 'week';
        }

        function autoRouteTask(card) {
            const col = state.columns.find(c => c.id === card.columnId);
            if (isCompletedColumn(col)) return false;
            const dateStr = card.startDate || card.deadline;
            const target = getTargetColumnForDate(dateStr);
            let targetCol = null;
            if (target === 'today') targetCol = findColumnByRole('today');
            else if (target === 'yesterday') targetCol = findColumnByRole('yesterday');
            else if (target === 'week') targetCol = findColumnByRole('week');
            else if (target === 'next-month') targetCol = findColumnByRole('next-month');
            if (targetCol && targetCol.id && card.columnId !== targetCol.id) {
                card.columnId = targetCol.id;
                return true;
            }
            return false;
        }

        function autoRouteTasks() {
            // Pop-up de déplacement ouvert : on fige l'automatisation le temps
            // que l'utilisateur valide ou annule son choix.
            if (_pendingColumnMove) return;
            let moved = false;
            state.cards.forEach(card => {
                if (autoRouteTask(card)) moved = true;
            });
            if (moved) {
                saveState();
                renderBoard();
                updateStats();
            }
        }

        /**
         * Animation de bienvenue — motion design du logo VN, jouée quand la
         * connexion du dossier est confirmée pour la première fois.
         * Récit en 4 actes : rassemblement des fragments → dessin du « N » →
         * connexion (ondes + particules + badge ✓) → révélation de l'app.
         * Clic = passer. prefers-reduced-motion = apparition quasi instantanée.
         */
        function playWelcomeAnimation() {
            if (window.__welcomePlayed) return;
            window.__welcomePlayed = true;
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            // Confettis : 14 éclats en cercle, formes et rotations mélangées
            const COLORS = ['#0A84FF', '#34C759', '#FF9500', '#5E5CE6'];
            const ANGLES = [-90, -64, -38, -12, 14, 40, 66, 90, 116, 142, 168, 194, 220, 246];
            const PARTICLES = ANGLES.map((a, i) => {
                const rad = a * Math.PI / 180;
                const r = i % 2 ? 106 : 92;
                const tx = Math.round(Math.cos(rad) * r);
                const ty = Math.round(Math.sin(rad) * r);
                const rot = 140 + (i * 47) % 260;
                const sq = i % 3 === 1 ? ' sq' : '';
                return `<span class="wn-p${sq}" style="--tx:${tx}px; --ty:${ty}px; --rot:${rot}deg; background:${COLORS[i % COLORS.length]};"></span>`;
            }).join('');

            // Poussière d'étoiles ambiante : petites bulles qui montent lentement
            const DOTS = Array.from({ length: 9 }, (_, i) => {
                const left = 6 + (i * 10.5) % 90;
                const dur = 8 + (i * 1.7) % 6;
                const delay = (i * 0.9) % 5;
                const size = i % 3 ? 5 : 7;
                const color = i % 4 === 2 ? '#34C759' : (i % 4 === 1 ? '#FF9500' : '#0A84FF');
                return `<span class="wn-dot" style="left:${left}%; width:${size}px; height:${size}px; background:${color}; animation-duration:${dur}s; animation-delay:-${delay}s;"></span>`;
            }).join('');

            // Masque = silhouette du logo, pour le balayage lumineux
            const LOGO_MASK = 'data:image/svg+xml;utf8,' + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g transform="translate(8 8) scale(.1875)" fill="#000">' +
                '<path d="M 72.0 98.0 L 122.0 250.0 L 124.0 251.0 L 124.0 130.0 L 122.0 243.0 L 74.0 99.0 Z"/>' +
                '<path d="M 94.0 5.0 L 73.0 11.0 L 47.0 26.0 L 40.0 79.0 L 36.0 36.0 L 15.0 59.0 L 31.0 126.0 L 2.0 87.0 L 31.0 213.0 Z"/>' +
                '<path d="M 117.0 3.0 L 123.0 119.0 L 124.0 106.0 L 119.0 13.0 L 121.0 13.0 L 195.0 231.0 L 211.0 219.0 L 225.0 204.0 L 238.0 184.0 L 245.0 168.0 L 227.0 131.0 L 228.0 129.0 L 249.0 153.0 L 252.0 120.0 L 245.0 85.0 L 234.0 62.0 L 217.0 40.0 L 205.0 155.0 L 195.0 227.0 L 119.0 3.0 Z"/>' +
                '</g></svg>'
            );

            const ov = document.createElement('div');
            ov.className = 'welcome-overlay';
            ov.setAttribute('role', 'status');
            ov.setAttribute('aria-label', 'Dossier connecté — bienvenue dans VN');
            ov.innerHTML = `
                <div class="wn-aurora">
                    <div class="wn-blob wn-b1"></div>
                    <div class="wn-blob wn-b2"></div>
                    <div class="wn-blob wn-b3"></div>
                    ${DOTS}
                </div>
                <div class="wn-content">
                    <div class="wn-stage">
                        <div class="wn-glow"></div>
                        <svg class="wn-seal" viewBox="0 0 190 190" aria-hidden="true"><circle cx="95" cy="95" r="88" pathLength="1"/></svg>
                        <div class="wn-ripple" style="animation-delay:2600ms;"></div>
                        <div class="wn-ripple" style="animation-delay:2950ms; border-width:1.5px;"></div>
                        <div class="wn-ripple" style="animation-delay:3350ms; border-width:1px;"></div>
                        <div class="wn-burst">${PARTICLES}</div>
                        <div class="wn-logo">
                            <svg viewBox="0 0 64 64" aria-hidden="true">
                                <g transform="translate(8 8) scale(.1875)">
                                    <path class="wn-f1" fill="currentColor" stroke="currentColor" stroke-width="3" stroke-linejoin="round" paint-order="stroke fill"
                                        d="M 72.0 98.0 L 122.0 250.0 L 124.0 251.0 L 124.0 130.0 L 122.0 243.0 L 74.0 99.0 Z"/>
                                    <path class="wn-f2" fill="currentColor" stroke="currentColor" stroke-width="3" stroke-linejoin="round" paint-order="stroke fill"
                                        d="M 94.0 5.0 L 73.0 11.0 L 47.0 26.0 L 40.0 79.0 L 36.0 36.0 L 15.0 59.0 L 31.0 126.0 L 2.0 87.0 L 31.0 213.0 Z"/>
                                    <path class="wn-f3" fill="currentColor" stroke="currentColor" stroke-width="3" stroke-linejoin="round" paint-order="stroke fill"
                                        d="M 117.0 3.0 L 123.0 119.0 L 124.0 106.0 L 119.0 13.0 L 121.0 13.0 L 195.0 231.0 L 211.0 219.0 L 225.0 204.0 L 238.0 184.0 L 245.0 168.0 L 227.0 131.0 L 228.0 129.0 L 249.0 153.0 L 252.0 120.0 L 245.0 85.0 L 234.0 62.0 L 217.0 40.0 L 205.0 155.0 L 195.0 227.0 L 119.0 3.0 Z"/>
                                    <g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
                                        <path class="wn-stroke wn-s1" pathLength="1" d="M 73 99 L 123 250"/>
                                        <path class="wn-stroke wn-s2" pathLength="1" d="M 118 5 L 123 118"/>
                                        <path class="wn-stroke wn-s3" pathLength="1" d="M 120 13 L 195 230"/>
                                    </g>
                                </g>
                            </svg>
                            <div class="wn-shimmer" style="-webkit-mask-image:url('${LOGO_MASK}'); mask-image:url('${LOGO_MASK}');"></div>
                        </div>
                    </div>
                    <div class="wn-texts">
                        <div class="wn-eyebrow">Bienvenue dans VN</div>
                        <div class="wn-title">Dossier connecté
                            <span class="wn-check"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path pathLength="1" d="M20 6 9 17l-5-5"/></svg></span>
                        </div>
                        <div class="wn-sub">Vos tâches sont synchronisées avec votre dossier.</div>
                    </div>
                </div>`;
            document.body.appendChild(ov);

            let dismissed = false;
            const dismiss = () => {
                if (dismissed || !ov.parentNode) return;
                dismissed = true;
                ov.classList.add('is-done');
                setTimeout(() => { if (ov.parentNode) ov.remove(); }, 420);
            };
            ov.addEventListener('click', dismiss);
            setTimeout(dismiss, reduceMotion ? 700 : 5400);
        }

        async function selectRootFolder() {
            try {
                const syncOverlay = document.getElementById('sync-overlay');
                const isFirstRun = !!(syncOverlay && syncOverlay.style.display !== 'none');
                dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });

                dataFileHandle = await dirHandle.getFileHandle('kanban-data.json', { create: true });
                archiveFileHandle = await dirHandle.getFileHandle('kanban-archive.json', { create: true });

                await loadStateFromFile();

                if (syncOverlay) syncOverlay.style.display = 'none';

                startApp();
                // Cloud synchronization replaces the old shared local/Root watcher.
                // Animation de bienvenue uniquement pour la connexion initiale
                // (pas pour les reconnexions via le bouton « Sync » de l'en-tête).
                if (isFirstRun) playWelcomeAnimation();
            } catch (error) {
                console.error("Erreur de sélection du dossier:", error);
                if (error.name !== 'AbortError') {
                    alert("Erreur lors de la sélection du dossier: " + error.message);
                }
            }
        }

        async function loadStateFromFile() {
            try {
                const dataFile = await dataFileHandle.getFile();
                lastModifiedTime = dataFile.lastModified;
                const dataText = await dataFile.text();
                lastWrittenSignature = contentHash(dataText);
                lastKnownFileText = dataText;
                if (dataText) {
                    const parsed = JSON.parse(dataText);
                    if (parsed.version === DATA_VERSION) {
                        state = sanitizeState(parsed);
                        migrateLegacyColumns();
                    } else if (!parsed.version || parsed.version < DATA_VERSION) {
                        console.log(`Migration DB v${parsed.version} → v${DATA_VERSION}`);
                        state = sanitizeState(migrateData(parsed));
                        migrateLegacyColumns();
                        setTimeout(()=>showToast(`Migration v${parsed.version} → v${DATA_VERSION} réussie : ${state.cards.length} tâches récupérées`), 800);
                    } else {
                        // version future inconnue : on garde tel quel (mais blindé)
                        state = sanitizeState(parsed);
                        migrateLegacyColumns();
                    }
                } else {
                    createDefaultColumns();
                }

                const archiveFile = await archiveFileHandle.getFile();
                const archiveText = await archiveFile.text();
                if (archiveText) {
                    // L'archive ne doit jamais faire échouer le chargement des tâches.
                    try { archive = sanitizeArchive(JSON.parse(archiveText)); }
                    catch (archiveError) {
                        console.warn('Archive illisible, réinitialisée :', archiveError);
                        archive = [];
                    }
                }

                if (state.columns.length === 0) createDefaultColumns();
            } catch (error) {
                console.error('Erreur chargement depuis le fichier:', error);
                createDefaultColumns();
            }
        }

        function loadStateLocal() {
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed.version === DATA_VERSION) {
                        state = sanitizeState(parsed);
                        migrateLegacyColumns();
                    } else if (!parsed.version || parsed.version < DATA_VERSION) {
                        console.log(`Migration DB locale v${parsed.version} → v${DATA_VERSION}`);
                        state = sanitizeState(migrateData(parsed));
                        migrateLegacyColumns();
                        setTimeout(()=>showToast(`Migration locale v${parsed.version} → v${DATA_VERSION} : ${state.cards.length} tâches`), 800);
                    } else {
                        state = parsed;
                        migrateLegacyColumns();
                    }
                }
                const savedArchive = localStorage.getItem(ARCHIVE_KEY);
                if (savedArchive) archive = JSON.parse(savedArchive);
                if (state.columns.length === 0) createDefaultColumns();
            } catch (error) {
                console.error('Erreur chargement local:', error);
                createDefaultColumns();
            }
        }

        function migrateData(oldData) {
            const columns = (oldData.columns || []).map(col => {
                const t = (col.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
                if (t === 'a faire' || t === 'aujourdhui') return { ...col, title: "Aujourd'hui", color: col.color || '#0071E3' };
                if (t === 'en cours' || t === 'demain') return { ...col, title: 'Dans la semaine', color: col.color || '#5856D6' };
                if (t === 'semaine prochaine') return { ...col, title: 'Dans la semaine', color: col.color || '#5856D6' };
                if (t === 'mois prochain' || t === 'le mois prochain') return { ...col, title: 'Mois prochain', color: col.color || '#AF52DE' };
                if (t === 'hier') return { ...col, title: 'Hier', color: col.color || '#FF9500' };
                return col;
            });
            return {
                version: DATA_VERSION,
                columns,
                cards: (oldData.cards || []).map(card => {
                    const newCard = {
                        ...card,
                        startDate: card.startDate || null,
                        duration: card.duration || null,
                        completionNote: card.completionNote || null,
                        timeHistory: card.timeHistory || [],
                        totalTimeSpent: card.totalTimeSpent || 0
                    };
                    if (newCard.isRecurring !== undefined) {
                        newCard.recurrence = newCard.isRecurring ? { type: 'daily' } : { type: 'none' };
                        delete newCard.isRecurring;
                    }
                    if (!newCard.recurrence) newCard.recurrence = { type: 'none' };
                    if (newCard.checklist) {
                        newCard.checklist = newCard.checklist.map(it => ({
                            text: it.text || it,
                            checked: !!it.checked,
                            required: it.required !== undefined ? !!it.required : true,
                            summary: it.summary || ''
                        }));
                    }
                    return newCard;
                }),
                nextColumnId: oldData.nextColumnId || 1,
                nextCardId: oldData.nextCardId || 1
            };
        }

        /* ============================================================
           BLINDAGE DES DONNÉES
           Toute base entrante (fichier Root, localStorage, appareil distant,
           fichier édité à la main, ancienne version) passe par ici.
           Objectif : plus aucun plantage de rendu à cause d'un champ manquant.
           ============================================================ */
        function sanitizeCard(raw, fallbackColumnId, usedIds) {
            const c = (raw && typeof raw === 'object') ? raw : {};
            let id = Number(c.id);
            if (!Number.isFinite(id) || id <= 0 || usedIds.has(id)) {
                id = 1; while (usedIds.has(id)) id++;
            }
            usedIds.add(id);
            c.id = id;
            c.title = typeof c.title === 'string' ? c.title : String(c.title || 'Tâche sans titre');
            c.description = typeof c.description === 'string' ? c.description : '';
            c.columnId = Number.isFinite(Number(c.columnId)) ? Number(c.columnId) : fallbackColumnId;
            c.priority = ['low', 'medium', 'high'].includes(c.priority) ? c.priority : 'medium';
            c.category = typeof c.category === 'string' && c.category ? c.category : 'perso';
            c.createdAt = typeof c.createdAt === 'string' ? c.createdAt : new Date().toISOString();
            c.totalTimeSpent = Number.isFinite(Number(c.totalTimeSpent)) ? Math.max(0, Number(c.totalTimeSpent)) : 0;
            if (!Array.isArray(c.checklist)) c.checklist = [];
            c.checklist = c.checklist.map(it => (it && typeof it === 'object')
                ? { text: String(it.text != null ? it.text : ''), checked: !!it.checked,
                    required: it.required !== false, summary: typeof it.summary === 'string' ? it.summary : '' }
                : { text: String(it != null ? it : ''), checked: false, required: true, summary: '' });
            if (!c.recurrence || typeof c.recurrence !== 'object') c.recurrence = { type: 'none' };
            if (typeof c.recurrence.type !== 'string') c.recurrence.type = 'none';
            if (c.dependencies != null && !Array.isArray(c.dependencies)) c.dependencies = [];
            return c;
        }

        function sanitizeState(raw) {
            const base = (raw && typeof raw === 'object') ? raw : {};
            if (!Array.isArray(base.columns)) base.columns = [];
            const seenCols = new Set();
            base.columns = base.columns
                .filter(col => col && typeof col === 'object')
                .map((col, i) => {
                    let id = Number(col.id);
                    if (!Number.isFinite(id) || id <= 0 || seenCols.has(id)) { id = i + 1; while (seenCols.has(id)) id++; }
                    seenCols.add(id);
                    return Object.assign(col, { id, title: typeof col.title === 'string' ? col.title : 'Colonne ' + id });
                });
            if (base.columns.length === 0) {
                base.columns = [
                    { id: 1, title: 'Hier', color: '#FF9500' },
                    { id: 2, title: "Aujourd'hui", color: '#0071E3' },
                    { id: 3, title: 'Dans la semaine', color: '#5856D6' },
                    { id: 4, title: 'Mois prochain', color: '#AF52DE' },
                    { id: 5, title: 'Terminé', color: '#34C759' }
                ];
            }
            const colIds = new Set(base.columns.map(c => c.id));
            const fallback = base.columns[0].id;
            if (!Array.isArray(base.cards)) base.cards = [];
            const usedIds = new Set();
            base.cards = base.cards.map(c => sanitizeCard(c, fallback, usedIds));
            // Aucune tâche orpheline : une carte pointant vers une colonne supprimée
            // serait invisible à l'écran tout en occupant la base.
            let rescued = 0;
            base.cards.forEach(c => { if (!colIds.has(c.columnId)) { c.columnId = fallback; rescued++; } });
            if (rescued > 0) console.warn('Données réparées : ' + rescued + ' tâche(s) orpheline(s) replacée(s).');
            const maxCard = base.cards.reduce((m, c) => Math.max(m, c.id), 0);
            const maxCol = base.columns.reduce((m, c) => Math.max(m, c.id), 0);
            base.nextCardId = Math.max(Number(base.nextCardId) || 1, maxCard + 1);
            base.nextColumnId = Math.max(Number(base.nextColumnId) || 1, maxCol + 1);
            if (!Number.isFinite(Number(base.version))) base.version = DATA_VERSION;
            return base;
        }

        /* ============================================================
           FUSION 3 VOIES (base / nous / eux)
           Sans elle, deux onglets (ou deux appareils) qui écrivent coup sur
           coup s'écrasent mutuellement : la dernière écriture gagne et le
           travail de l'autre disparaît silencieusement.
           Référence : `base` = dernier contenu que NOUS avons lu ou écrit.
           ============================================================ */
        let lastKnownFileText = '';

        /* Deux onglets (ou deux appareils) qui créent une tâche en même temps
           tiraient exactement le même `nextCardId` : à la fusion, l'une écrasait
           l'autre. On décale donc chaque allocation d'un petit pas aléatoire et
           on vérifie l'unicité réelle. */
        function allocateId(kind) {
            if (kind === 'note') return generateNoteId();
            const liste = kind === 'column' ? (state.columns || []) : (state.cards || []);
            const used = new Set(liste.map(x => Number(x.id)));
            const compteur = Number(kind === 'column' ? state.nextColumnId : state.nextCardId) || 1;
            const plancher = Math.max(compteur, ...(used.size ? [...used] : [0])) + 1;
            let id = plancher + Math.floor(Math.random() * 97);
            while (used.has(id)) id++;
            if (kind === 'column') state.nextColumnId = id + 1; else state.nextCardId = id + 1;
            return id;
        }

        function indexById(list) {
            const m = new Map();
            (list || []).forEach(x => { if (x && x.id != null) m.set(x.id, x); });
            return m;
        }

        function mergeCollections(baseList, ourList, theirList) {
            const b = indexById(baseList), o = indexById(ourList), t = indexById(theirList);
            const garde = new Map();
            const stats = { nous: 0, eux: 0, supprimes: 0, conflits: 0 };
            const ids = new Set([...o.keys(), ...t.keys()]);
            for (const id of ids) {
                const bb = b.get(id), oo = o.get(id), tt = t.get(id);
                const sb = bb ? JSON.stringify(bb) : null;
                const so = oo ? JSON.stringify(oo) : null;
                const st = tt ? JSON.stringify(tt) : null;
                if (oo && !tt) {
                    if (!bb) { garde.set(id, oo); stats.nous++; }            // créé ici
                    else if (so === sb) { stats.supprimes++; }               // supprimé ailleurs, intact ici
                    else { garde.set(id, oo); stats.conflits++; }            // supprimé ailleurs mais modifié ici → on garde
                } else if (!oo && tt) {
                    if (!bb) { garde.set(id, tt); stats.eux++; }             // créé ailleurs
                    else if (st === sb) { stats.supprimes++; }               // supprimé ici, intact ailleurs
                    else { garde.set(id, tt); stats.conflits++; }
                } else if (oo && tt) {
                    if (so === st) garde.set(id, oo);
                    else if (sb === so) { garde.set(id, tt); stats.eux++; }  // modifié seulement ailleurs
                    else if (sb === st) { garde.set(id, oo); stats.nous++; } // modifié seulement ici
                    else if (!bb) {
                        // Même identifiant, mais deux créations INDÉPENDANTES
                        // (collision entre onglets) : on garde les DEUX,
                        // en réattribuant un identifiant libre au nôtre.
                        garde.set(id, tt);
                        const copie = JSON.parse(JSON.stringify(oo));
                        let nouveau = Math.max(id, ...[...ids]) + 1;
                        while (garde.has(nouveau) || ids.has(nouveau)) nouveau++;
                        copie.id = nouveau;
                        garde.set(nouveau, copie);
                        stats.collisions = (stats.collisions || 0) + 1;
                    }
                    else { garde.set(id, oo); stats.conflits++; }            // vrai conflit → priorité à l'écran actif
                }
            }
            // ordre stable : d'abord l'ordre du fichier, puis nos ajouts
            const out = [];
            (theirList || []).forEach(x => { if (x && garde.has(x.id)) { out.push(garde.get(x.id)); garde.delete(x.id); } });
            (ourList || []).forEach(x => { if (x && garde.has(x.id)) { out.push(garde.get(x.id)); garde.delete(x.id); } });
            garde.forEach(v => out.push(v));
            return { items: out, stats };
        }

        function mergeStates(baseState, ourState, theirState) {
            const cards = mergeCollections(baseState.cards, ourState.cards, theirState.cards);
            const cols = mergeCollections(baseState.columns, ourState.columns, theirState.columns);
            const fusionne = sanitizeState({
                version: DATA_VERSION,
                columns: cols.items.length ? cols.items : theirState.columns,
                cards: cards.items,
                nextCardId: Math.max(ourState.nextCardId || 1, theirState.nextCardId || 1),
                nextColumnId: Math.max(ourState.nextColumnId || 1, theirState.nextColumnId || 1),
                customCategories: ourState.customCategories || theirState.customCategories
            });
            const stats = {
                nous: cards.stats.nous + cols.stats.nous,
                eux: cards.stats.eux + cols.stats.eux,
                supprimes: cards.stats.supprimes + cols.stats.supprimes,
                conflits: cards.stats.conflits + cols.stats.conflits
            };
            return { state: fusionne, stats };
        }

        /** Applique le contenu disque sur l'état mémoire, sans rien perdre.
         *  Renvoie { applique, doitReecrire }. */
        function integrerContenuDisque(texteDisque) {
            let distant;
            try { distant = sanitizeState(JSON.parse(texteDisque)); }
            catch (e) {
                // Cas géré : on garde la mémoire (qui sera réécrite par-dessus),
                // mais l'utilisateur doit savoir que son fichier est abîmé.
                console.warn('Contenu du dossier Root illisible, conservation de la version en mémoire :', e && e.message);
                showToast('Fichier Root illisible — vos tâches en mémoire sont conservées');
                return { applique: false, doitReecrire: false };
            }
            if (distant.version !== DATA_VERSION && distant.version < DATA_VERSION) distant = sanitizeState(migrateData(distant));

            let base = null;
            if (lastKnownFileText) { try { base = sanitizeState(JSON.parse(lastKnownFileText)); } catch (e) { base = null; } }

            if (!base) {
                // Pas de référence : le fichier fait autorité, on ne préserve que
                // les tâches créées ici à l'instant (elles ne peuvent pas y figurer).
                const RECENT_MS = 15000, maintenant = Date.now();
                const fraiches = state.cards.filter(c => {
                    const t = Date.parse(c.createdAt);
                    return Number.isFinite(t) && (maintenant - t) < RECENT_MS && !distant.cards.some(x => x.id === c.id);
                });
                fraiches.forEach(c => distant.cards.push(c));
                state = sanitizeState(distant);
                lastKnownFileText = texteDisque;
                return { applique: true, doitReecrire: fraiches.length > 0 };
            }

            const { state: fusionne, stats } = mergeStates(base, state, distant);
            state = fusionne;
            lastKnownFileText = texteDisque;
            const doitReecrire = JSON.stringify(fusionne.cards) !== JSON.stringify(distant.cards)
                || JSON.stringify(fusionne.columns) !== JSON.stringify(distant.columns);
            if (stats.nous || stats.eux || stats.supprimes || stats.conflits) {
                console.log('Fusion Root →', stats);
            }
            return { applique: true, doitReecrire };
        }

        function sanitizeArchive(raw) {
            if (Array.isArray(raw)) return raw.filter(x => x && typeof x === 'object');
            if (raw && typeof raw === 'object' && Array.isArray(raw.items)) return raw.items;
            return [];
        }

        let ioQueue = Promise.resolve();

        /* FIX : une seule erreur non rattrapée figeait DÉFINITIVEMENT la file
           d'écriture (plus aucune sauvegarde ensuite, en silence). */
        function enqueueIO(task) {
            ioQueue = ioQueue.then(task).catch(err => {
                console.error('Erreur dans la file de sauvegarde (récupérée) :', err);
                if (window.VN_SYNC) window.VN_SYNC.stats.errors++;
            });
            return ioQueue;
        }

        /* Écriture fiable dans le dossier Root :
           1. tentative normale ;
           2. si elle échoue (permission momentanément perdue, fichier déplacé,
              recréé par un client de synchro...), on redemande le handle au
              dossier Root et on réessaie ;
           3. seulement en dernier recours, bascule sur la sauvegarde locale.
           L'ancien code abandonnait le dossier dès la PREMIÈRE erreur. */
        async function writeThroughHandle(handle, text) {
            const writable = await handle.createWritable();
            await writable.write(text);
            await writable.close();
            return handle.getFile();
        }

        /* Écriture VÉRIFIÉE : on relit le contenu réellement présent sur le disque.
           Indispensable, car si un autre onglet écrit dans la même milliseconde,
           l'horodatage relu est le SIEN : on croirait avoir enregistré alors que
           notre version vient d'être écrasée (perte de données silencieuse).
           Si un écrasement est détecté : fusion puis réécriture. */
        async function writeVerified(handle, texte, kind, essaisRestants) {
            if (essaisRestants === undefined) essaisRestants = 3;
            const file = await writeThroughHandle(handle, texte);
            let surDisque;
            try { surDisque = await file.text(); }
            catch (e) { return { file: file, texte: texte }; }
            if (contentHash(surDisque) === contentHash(texte)) return { file: file, texte: texte };
            if (essaisRestants <= 0) {
                console.warn('Écriture concurrente persistante : contenu du disque conservé.');
                return { file: file, texte: surDisque, conflit: true };
            }
            console.log('Écrasement concurrent détecté à l\'écriture → fusion et réécriture.');
            if (kind === 'data') {
                integrerContenuDisque(surDisque);
                state.version = DATA_VERSION;
                return writeVerified(handle, JSON.stringify(state, null, 2), kind, essaisRestants - 1);
            }
            return writeVerified(handle, texte, kind, essaisRestants - 1);
        }

        async function writeRootFile(kind, text) {
            const fileName = kind === 'archive' ? 'kanban-archive.json' : 'kanban-data.json';
            const handle = kind === 'archive' ? archiveFileHandle : dataFileHandle;
            if (!handle) return false;
            const noteSucces = (res) => {
                if (kind === 'data') {
                    lastModifiedTime = res.file.lastModified;
                    lastWrittenSignature = contentHash(res.texte);
                    lastKnownFileText = res.texte;
                }
            };
            try {
                noteSucces(await writeVerified(handle, text, kind));
                return true;
            } catch (error) {
                console.warn('Écriture Root échouée (' + fileName + '), tentative de récupération :', error && error.name);
                if (!dirHandle) return false;
                try {
                    if (dirHandle.queryPermission) {
                        let perm = await dirHandle.queryPermission({ mode: 'readwrite' });
                        if (perm !== 'granted' && dirHandle.requestPermission) {
                            perm = await dirHandle.requestPermission({ mode: 'readwrite' });
                        }
                        if (perm !== 'granted') throw new Error('permission non accordée');
                    }
                    const fresh = await dirHandle.getFileHandle(fileName, { create: true });
                    noteSucces(await writeVerified(fresh, text, kind));
                    if (kind === 'archive') archiveFileHandle = fresh; else dataFileHandle = fresh;
                    console.log('Connexion au dossier Root rétablie automatiquement.');
                    return true;
                } catch (retryError) {
                    console.error('Récupération du dossier Root impossible :', retryError);
                    return false;
                }
            }
        }

        // localStorage peut être plein (QuotaExceededError) ou bloqué (mode privé) :
        // ne jamais laisser cette erreur casser une sauvegarde.
        function saveLocalSafe(key, text) {
            try {
                localStorage.setItem(key, text);
                return true;
            } catch (error) {
                console.error('Sauvegarde locale impossible (' + key + ') :', error && error.name);
                showToast('Espace de stockage local saturé — connectez le dossier Root');
                return false;
            }
        }

        /** Avant d'écrire : quelqu'un a-t-il touché le fichier depuis notre
         *  dernière lecture ? Si oui on fusionne AVANT d'écraser. */
        async function fusionnerAvantEcriture() {
            if (!dataFileHandle || lastModifiedTime <= 0) return false;
            try {
                const file = await dataFileHandle.getFile();
                if (window.VN_DEBUG) console.log('[pre-write] lm=' + file.lastModified + ' connu=' + lastModifiedTime);
                if (file.lastModified === lastModifiedTime) return false;
                const texte = await file.text();
                if (contentHash(texte) === lastWrittenSignature) {
                    lastModifiedTime = file.lastModified;
                    return false;
                }
                const res = integrerContenuDisque(texte);
                lastModifiedTime = file.lastModified;
                if (res.applique) {
                    console.log('Écriture concurrente détectée : fusion effectuée avant sauvegarde.');
                    return true;
                }
            } catch (e) {
                console.warn('Vérification avant écriture impossible :', e && e.name);
            }
            return false;
        }

        function saveState() {
            window.vnQueueSave?.();
            _cardsIndexDirty = true;

            state.version = DATA_VERSION;

            enqueueIO(async () => {
                const fusionne = await fusionnerAvantEcriture();
                const stateCopy = JSON.stringify(state, null, 2);
                if (dataFileHandle) {
                    const ok = await writeRootFile('data', stateCopy);
                    if (ok) lastKnownFileText = stateCopy;
                    if (!ok) {
                        dataFileHandle = null;
                        saveLocalSafe(STORAGE_KEY, stateCopy);
                        showToast('Dossier Root indisponible — sauvegarde locale activée');
                    }
                } else {
                    saveLocalSafe(STORAGE_KEY, stateCopy);
                }
                // SYNC INSTANTANÉE : prévenir les autres onglets/fenêtres immédiatement
                broadcastRootWrite();
                if (window.VN_SYNC) window.VN_SYNC.stats.writes++;
                if (fusionne) { renderBoard(); updateStats(); }
            });
        }

        function saveArchive() {
            window.vnQueueSave?.();
            const archiveCopy = JSON.stringify(archive, null, 2);

            enqueueIO(async () => {
                if (archiveFileHandle) {
                    const ok = await writeRootFile('archive', archiveCopy);
                    if (!ok) {
                        archiveFileHandle = null;
                        saveLocalSafe(ARCHIVE_KEY, archiveCopy);
                    }
                } else {
                    saveLocalSafe(ARCHIVE_KEY, archiveCopy);
                }
            });
        }

        // =========== SUBTASK REQUIRED LOGIC ===========
        function canCompleteTask(card) {
            if (!card.checklist || card.checklist.length === 0) return { ok: true };
            // Par défaut, toute sous-tâche est obligatoire. Si required explicitement false => optionnelle
            const incompleteReq = card.checklist.filter(i => (i.required !== false) && !i.checked);
            if (incompleteReq.length > 0) {
                return { ok: false, count: incompleteReq.length, items: incompleteReq };
            }
            return { ok: true };
        }


        function getTomorrowStr() {
            const d = new Date(); d.setDate(d.getDate()+1);
            return localDateStr(d);
        }

        // =========== DÉPLACEMENT KANBAN — POP-UP « DATE + HEURE » AUTOMATIQUE ===========
        // Dès qu'une carte quitte sa colonne (drag & drop du kanban), un pop-up
        // s'ouvre : il pré-remplit la date correspondant à la colonne cible
        // (Hier / Aujourd'hui / Dans la semaine / Mois prochain) et le premier
        // créneau horaire libre de cette journée (8h-22h, sans chevauchement).
        // Rien n'est enregistré avant validation : « Annuler », la croix, le clic
        // hors cadre et la touche Échap remettent la carte dans sa colonne d'origine.
        let _pendingColumnMove = null;

        function getColumnMoveRole(col) {
            if (!col) return 'custom';
            if (isCompletedColumn(col)) return 'completed';
            if (isYesterdayColumn(col)) return 'yesterday';
            if (isTodayColumn(col)) return 'today';
            if (isWeekColumn(col)) return 'week';
            if (isNextMonthColumn(col)) return 'next-month';
            return 'custom';
        }

        function getMoveDuration(card) {
            const d = parseInt(card && card.duration, 10);
            return (d && d > 0) ? d : 60;
        }

        function prettyMoveDate(dateStr, style) {
            const d = parseLocalDate(dateStr);
            if (!d) return dateStr || 'aucune date';
            if (style === 'short') return d.toLocaleDateString('fr-FR');
            return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        }

        // Date proposée en fonction du rôle de la colonne de destination.
        function getSuggestedDateForMove(role, card) {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const current = card.startDate || card.deadline || null;
            const currentD = parseLocalDate(current);
            const firstNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
            firstNextMonth.setHours(0, 0, 0, 0);

            if (role === 'today') return localDateStr(today);
            if (role === 'yesterday') return getYesterdayStr();
            if (role === 'week') {
                // Une date déjà future et antérieure au mois prochain reste valable.
                if (currentD && currentD.getTime() > today.getTime() && currentD.getTime() < firstNextMonth.getTime()) return current;
                const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
                return localDateStr(tomorrow);
            }
            if (role === 'next-month') {
                if (currentD && currentD.getTime() >= firstNextMonth.getTime()) return current;
                return localDateStr(firstNextMonth);
            }
            // Terminé ou colonne personnalisée : aucune date imposée, on conserve.
            return current;
        }

        // Heure proposée.
        // - la tâche change de jour  → premier créneau libre de la nouvelle date
        //   (8h-22h, sans chevauchement) ; à défaut son heure actuelle, sinon
        //   l'heure du moment arrondie au quart d'heure suivant ;
        // - la tâche garde son jour (Terminé, colonne personnalisée, date déjà
        //   correcte) → on conserve son heure, simplement modifiable.
        function getSuggestedTimeForMove(dateStr, card, keepCurrent) {
            const duration = getMoveDuration(card);
            const slots = dateStr ? (findFreeTimeSlots(dateStr, duration, card.id) || []) : [];
            if (keepCurrent && card.scheduledTime) return { time: card.scheduledTime, slots: slots, hasFreeSlot: slots.length > 0 };
            if (!dateStr) return { time: card.scheduledTime || '', slots: [], hasFreeSlot: false };
            if (slots.length > 0) return { time: minsToHHMM(slots[0].start), slots: slots, hasFreeSlot: true };
            const now = new Date();
            const fallback = card.scheduledTime || minsToHHMM(Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15);
            return { time: fallback, slots: [], hasFreeSlot: false };
        }

        const MA_DAY_START = 8 * 60;   // frise horaire du pop-up (8h → 22h)
        const MA_DAY_END = 22 * 60;

        function showColumnMoveModal(cardId, fromColumnId, toColumnId) {
            const card = state.cards.find(c => c.id === cardId);
            const fromCol = state.columns.find(c => c.id === fromColumnId);
            const toCol = state.columns.find(c => c.id === toColumnId);
            if (!card || !toCol) { renderBoardImmediate(); return; }

            _pendingColumnMove = { cardId: cardId, fromColumnId: fromColumnId, toColumnId: toColumnId };

            const role = getColumnMoveRole(toCol);
            const suggestedDate = getSuggestedDateForMove(role, card) || '';
            const dateChanged = String(card.startDate || '') !== String(suggestedDate || '');
            const suggested = getSuggestedTimeForMove(suggestedDate, card, !dateChanged);
            const needsAdapt = dateChanged || String(card.scheduledTime || '') !== String(suggested.time || '');
            const fromColor = (fromCol && fromCol.color) || '#8E8E93';
            const toColor = (toCol && toCol.color) || '#8E8E93';

            const modal = createModal(`Déplacer vers « ${toCol.title} »`, `
                <style>
                    .ma-head { display:flex; align-items:center; gap:8px; margin:0 0 8px; }
                    .ma-chip { display:inline-flex; align-items:center; gap:7px; max-width:44%; font-size:12.5px; font-weight:600; color:var(--ink); padding:5px 11px; border-radius:999px; background:var(--bg-alt); border:1px solid var(--line); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
                    .ma-chip i { flex:none; width:8px; height:8px; border-radius:50%; }
                    .ma-arrow { flex:none; color:var(--ink-soft); }
                    .ma-task { font-size:13px; color:var(--ink-soft); margin:0 0 14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
                    .ma-fields { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
                    .ma-fields label { display:flex; flex-direction:column; gap:5px; font-size:10.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-soft); }
                    .ma-fields input { text-align:center; font-size:15px; font-weight:600; font-variant-numeric:tabular-nums; }
                    .ma-tl { position:relative; height:96px; border-radius:14px; background:linear-gradient(180deg, rgba(0,0,0,.02), rgba(0,0,0,0) 30%), var(--bg-alt); border:1px solid var(--line); box-shadow:inset 0 1px 2px rgba(0,0,0,.04); overflow:hidden; cursor:pointer; user-select:none; -webkit-user-select:none; touch-action:none; }
                    .ma-tick { position:absolute; top:32px; bottom:22px; width:1px; background:var(--line); pointer-events:none; }
                    .ma-hour { position:absolute; bottom:5px; transform:translateX(-50%); font-size:9.5px; color:var(--ink-soft); font-variant-numeric:tabular-nums; pointer-events:none; }
                    .ma-busy { position:absolute; top:32px; height:34px; border-radius:9px; background:rgba(142,142,147,.20); border:1px solid rgba(142,142,147,.32); display:flex; align-items:center; justify-content:center; font-size:9.5px; font-weight:600; color:var(--ink-soft); overflow:hidden; white-space:nowrap; padding:0 6px; pointer-events:none; }
                    .ma-now { position:absolute; top:30px; bottom:22px; width:2px; background:var(--sys-red); opacity:.5; border-radius:1px; pointer-events:none; }
                    .ma-bubble { position:absolute; bottom:calc(100% + 7px); left:50%; transform:translateX(-50%); height:20px; padding:0 8px; border-radius:7px; background:var(--blue); color:#fff; font-size:11px; font-weight:700; font-variant-numeric:tabular-nums; display:flex; align-items:center; box-shadow:0 2px 8px rgba(0,113,227,.30); cursor:grab; white-space:nowrap; transition:background .15s, box-shadow .15s; }
                    .ma-bubble.ko { background:var(--sys-red); box-shadow:0 2px 8px rgba(255,59,48,.30); }
                    .ma-chip-ev { position:absolute; left:0; top:32px; height:34px; border-radius:10px; background:linear-gradient(180deg, #0A84FF, #0071E3); box-shadow:0 3px 12px rgba(0,113,227,.35), inset 0 1px 0 rgba(255,255,255,.25); cursor:grab; display:flex; align-items:center; justify-content:center; z-index:2; will-change:transform; touch-action:none; transition:box-shadow .15s, background .15s, filter .15s; }
                    .ma-chip-ev.glide { transition:transform .22s cubic-bezier(.32,.72,0,1), box-shadow .15s, background .15s; }
                    .ma-chip-ev.settle { transition:transform .18s cubic-bezier(.22,1,.36,1), box-shadow .15s, background .15s; }
                    .ma-chip-ev i { display:block; width:14px; height:3px; border-radius:2px; background:rgba(255,255,255,.9); box-shadow:0 6px 0 rgba(255,255,255,.9), 0 -6px 0 rgba(255,255,255,.9); pointer-events:none; transition:transform .15s; }
                    .ma-chip-ev.grab { cursor:grabbing; transition:box-shadow .15s, background .15s !important; filter:brightness(1.05); box-shadow:0 8px 20px rgba(0,113,227,.45), inset 0 1px 0 rgba(255,255,255,.3); z-index:4; }
                    .ma-chip-ev.grab .ma-bubble { cursor:grabbing; }
                    .ma-chip-ev.grab i { transform:scaleX(1.1); }
                    .ma-chip-ev.ko { background:linear-gradient(180deg, #FF6961, #FF3B30); box-shadow:0 3px 12px rgba(255,59,48,.40), inset 0 1px 0 rgba(255,255,255,.25); }
                    .ma-chip-ev.ko.grab { box-shadow:0 8px 20px rgba(255,59,48,.50), inset 0 1px 0 rgba(255,255,255,.3); }
                    .ma-status { display:flex; align-items:center; gap:7px; margin-top:10px; font-size:12.5px; font-weight:600; }
                    .ma-status svg { flex:none; }
                    .ma-status.ok { color:#248A3D; }
                    .ma-status.ko { color:var(--sys-red); }
                    .ma-status.warn { color:#B85E00; }
                    .ma-slots { display:flex; gap:6px; flex-wrap:wrap; margin-top:10px; }
                    .ma-slot { font-size:11.5px; font-weight:600; font-variant-numeric:tabular-nums; padding:5px 10px; border-radius:999px; border:1px solid rgba(52,199,89,.40); background:var(--sys-green-bg); color:#248A3D; cursor:pointer; transition:transform .15s cubic-bezier(.32,.72,0,1), background .15s, color .15s, border-color .15s; }
                    .ma-slot:hover { border-color:#248A3D; transform:translateY(-1px); }
                    .ma-slot:active { transform:scale(.96); }
                    .ma-slot.on { background:var(--blue); border-color:var(--blue); color:#fff; }
                    @media (prefers-reduced-motion: reduce) {
                        .ma-chip-ev, .ma-bubble, .ma-busy, .ma-status, .ma-slot { animation:none !important; transition:none !important; }
                    }
                </style>
                <div class="ma-head">
                    <span class="ma-chip"><i style="background:${fromColor}"></i>${escapeHtml(fromCol ? fromCol.title : '—')}</span>
                    <svg class="ma-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
                    <span class="ma-chip"><i style="background:${toColor}"></i>${escapeHtml(toCol.title)}</span>
                </div>
                <div class="ma-task" title="${escapeHtml(card.title)}">${escapeHtml(card.title)}</div>
                <div class="ma-fields">
                    <label for="move-adapt-date">Date<input type="date" class="form-input" id="move-adapt-date" value="${escapeHtml(suggestedDate)}"></label>
                    <label for="move-adapt-time">Heure<input type="time" class="form-input" id="move-adapt-time" value="${escapeHtml(suggested.time || '')}"></label>
                </div>
                <div id="move-adapt-preview"></div>
            `, [
                { text: 'Annuler', class: 'btn-secondary', onclick: 'cancelColumnMove()' },
                { text: 'Sans changer', class: 'btn-secondary', onclick: 'confirmColumnMove(false)' },
                { text: needsAdapt ? 'Adapter & déplacer' : 'Déplacer', class: 'btn-primary', onclick: 'confirmColumnMove(true)' }
            ]);
            document.body.appendChild(modal);

            // Toute fermeture « passive » du pop-up annule le déplacement.
            const closeBtn = modal.querySelector('.modal-close');
            if (closeBtn) closeBtn.setAttribute('onclick', 'cancelColumnMove()');
            modal.onclick = (e) => { if (e.target === modal) cancelColumnMove(); };

            const dateEl = document.getElementById('move-adapt-date');
            const timeEl = document.getElementById('move-adapt-time');
            if (dateEl) dateEl.addEventListener('change', renderColumnMovePreview);
            if (timeEl) timeEl.addEventListener('input', () => {
                if (timeEl.value) maSetTime(timeToMins(timeEl.value), true);
                else renderColumnMovePreview();
            });

            window.addEventListener('resize', maRelayout);
            renderColumnMovePreview();
            if (timeEl) { try { timeEl.focus(); } catch (e) {} }
        }

        // =========== FRISE HORAIRE — INTERACTIVE & OPTIMISÉE (style iOS) ===========
        // Le jeton ne se déplace qu'en transform (translate3d) : zéro recalcul de
        // layout pendant le glissement, une seule écriture DOM par frame (rAF).
        // Les mises à jour « contenu » (bulle, statut, pastilles) ne partent que
        // lorsque le cran de 15 min change. Bords élastiques façon iOS, settling
        // doux au relâchement, et respect de prefers-reduced-motion.
        let _maLastKey = '';   // date|heure déjà affichés → évite les écritures inutiles
        let _maGlideTimer = 0;

        function maClampSnap(mins, dur, step = 1) {
            const maxStart = Math.max(MA_DAY_START, MA_DAY_END - dur);
            const snapped = step > 1 ? Math.round(mins / step) * step : Math.round(mins);
            return Math.max(MA_DAY_START, Math.min(maxStart, snapped));
        }

        function maElements() {
            const track = document.querySelector('#move-adapt-preview .ma-tl');
            if (!track) return null;
            const chip = track.querySelector('.ma-chip-ev');
            const bubble = track.querySelector('.ma-bubble');
            if (!chip || !bubble) return null;
            return { track: track, chip: chip, bubble: bubble };
        }

        function maX(track, mins) {
            return ((mins - MA_DAY_START) / (MA_DAY_END - MA_DAY_START)) * track.clientWidth;
        }

        // Écritures « contenu » : uniquement quand l'heure affichée change.
        function maCommit(dateStr, tStr, dur, card, toCol) {
            const key = dateStr + '|' + tStr;
            if (key === _maLastKey) return;
            _maLastKey = key;
            const ti = document.getElementById('move-adapt-time');
            if (ti && ti.value !== tStr) ti.value = tStr;
            const els = maElements();
            if (!els) return;
            const ko = checkTimelineCollisions({ startDate: dateStr, deadline: null, scheduledTime: tStr, duration: dur }, card.id).length > 0;
            els.chip.classList.toggle('ko', ko);
            els.bubble.classList.toggle('ko', ko);
            els.bubble.textContent = tStr;
            const st = document.getElementById('ma-status');
            if (st) {
                const tmp = document.createElement('div');
                tmp.innerHTML = maStatusHTML(dateStr, tStr, dur, card, toCol);
                const fresh = tmp.firstChild;
                if (fresh) {
                    st.className = fresh.className;
                    st.title = fresh.title || '';
                    st.innerHTML = fresh.innerHTML;
                }
            }
            document.querySelectorAll('#move-adapt-preview .ma-slot').forEach(sl => {
                sl.classList.toggle('on', sl.dataset.start === tStr);
            });
        }

        // Place le jeton : 'instant' | 'glide' (glissement doux) | 'settle' (repos)
        function maPlace(mins, mode) {
            const p = _pendingColumnMove;
            if (!p) return;
            const card = state.cards.find(c => c.id === p.cardId);
            if (!card) return;
            const dur = getMoveDuration(card);
            const snapped = maClampSnap(mins, dur, 1);
            const tStr = minsToHHMM(snapped);
            const ti = document.getElementById('move-adapt-time');
            if (ti && ti.value !== tStr) ti.value = tStr;
            const els = maElements();
            if (!els) { _maLastKey = ''; renderColumnMovePreview(); return; }
            if (_maGlideTimer) { clearTimeout(_maGlideTimer); _maGlideTimer = 0; }
            els.chip.classList.remove('glide', 'settle', 'grab');
            if (mode && mode !== 'instant') {
                els.chip.classList.add(mode);
                _maGlideTimer = setTimeout(() => {
                    els.chip.classList.remove('glide', 'settle');
                    _maGlideTimer = 0;
                }, 240);
            }
            els.chip.dataset.mins = String(snapped);
            els.chip.style.transform = 'translate3d(' + maX(els.track, snapped) + 'px,0,0)';
            const dateStr = (document.getElementById('move-adapt-date') || {}).value || '';
            maCommit(dateStr, tStr, dur, card, state.columns.find(c => c.id === p.toColumnId));
        }

        function maSetTime(mins, smooth) { maPlace(mins, smooth ? 'glide' : 'instant'); }

        // Le jeton est placé en pixels : si la largeur de la piste change
        // (redimensionnement, rotation), on le recale immédiatement sur son heure.
        function maRelayout() {
            if (!_pendingColumnMove) { window.removeEventListener('resize', maRelayout); return; }
            const els = maElements();
            if (!els) return;
            const t = (document.getElementById('move-adapt-time') || {}).value;
            if (!t) return;
            const card = state.cards.find(c => c.id === _pendingColumnMove.cardId);
            if (!card) return;
            const mins = Number(els.chip.dataset.mins) || timeToMins(t);
            els.chip.style.transform = 'translate3d(' + maX(els.track, mins) + 'px,0,0)';
        }

        function wireTimeline() {
            const els = maElements();
            const track0 = els ? els.track : document.querySelector('#move-adapt-preview .ma-tl');
            if (!track0) return;
            const p = _pendingColumnMove;
            const card = p && state.cards.find(c => c.id === p.cardId);
            if (!card) return;

            // Pas encore d'heure : un premier clic pose le jeton.
            if (!els) {
                track0.addEventListener('pointerdown', (e) => {
                    const r = track0.getBoundingClientRect();
                    const dur0 = getMoveDuration(card);
                    const m = MA_DAY_START + ((e.clientX - r.left) / Math.max(1, r.width)) * (MA_DAY_END - MA_DAY_START);
                    maPlace(maClampSnap(m - dur0 / 2, dur0, 15), 'instant');
                }, { once: true });
                return;
            }

            const dur = getMoveDuration(card);
            const toCol = state.columns.find(c => c.id === p.toColumnId);
            const span = MA_DAY_END - MA_DAY_START;
            let rect = null, dragging = false, activePointerId = null, grabOffset = 0, rawMins = 0, rafId = 0;

            const minsAt = cx => {
                const r = rect || track0.getBoundingClientRect();
                return MA_DAY_START + ((cx - r.left) / Math.max(1, r.width)) * span;
            };

            const applyAt = (mins) => {
                const clamped = maClampSnap(mins, dur, 1);
                els.chip.dataset.mins = String(clamped);
                els.chip.style.transform = 'translate3d(' + maX(els.track, clamped) + 'px,0,0)';
                const dateStr = (document.getElementById('move-adapt-date') || {}).value || '';
                maCommit(dateStr, minsToHHMM(clamped), dur, card, toCol);
            };

            // Une seule passe DOM par frame d'affichage, alignée au pixel sans rebond parasite.
            const frame = () => {
                rafId = 0;
                if (!dragging) return;
                applyAt(rawMins - grabOffset);
            };

            const down = e => {
                if (e.button !== undefined && e.button !== 0) return;
                if (_maGlideTimer) { clearTimeout(_maGlideTimer); _maGlideTimer = 0; }
                els.chip.classList.remove('glide', 'settle');
                rect = track0.getBoundingClientRect();
                const m = minsAt(e.clientX);
                const timeVal = (document.getElementById('move-adapt-time') || {}).value || '08:00';
                const cur = Number.isFinite(Number(els.chip.dataset.mins)) ? Number(els.chip.dataset.mins) : timeToMins(timeVal);
                const chipRect = els.chip.getBoundingClientRect();
                const bubbleRect = els.bubble.getBoundingClientRect();
                const hitLeft = Math.min(chipRect.left, bubbleRect.left) - 4;
                const hitRight = Math.max(chipRect.right, bubbleRect.right) + 4;
                const onChip = e.target === els.chip || els.chip.contains(e.target) || (e.clientX >= hitLeft && e.clientX <= hitRight);

                dragging = true;
                activePointerId = e.pointerId;
                rawMins = m;
                els.chip.classList.add('grab');

                if (onChip) {
                    grabOffset = m - cur;
                } else {
                    const target = maClampSnap(m - dur / 2, dur, 1);
                    grabOffset = m - target;
                    applyAt(target);
                }
                try { track0.setPointerCapture(e.pointerId); } catch (err) {}
                e.preventDefault();
            };

            const moveEvt = e => {
                if (!dragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
                rawMins = minsAt(e.clientX);
                if (!rafId) rafId = requestAnimationFrame(frame);
                e.preventDefault();
            };

            const up = e => {
                if (!dragging || (e && e.pointerId !== undefined && activePointerId !== null && e.pointerId !== activePointerId)) return;
                if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
                if (e && Number.isFinite(e.clientX)) rawMins = minsAt(e.clientX);
                applyAt(rawMins - grabOffset);
                dragging = false;
                const pid = activePointerId;
                activePointerId = null;
                els.chip.classList.remove('grab');
                if (pid !== null) {
                    try { if (track0.hasPointerCapture(pid)) track0.releasePointerCapture(pid); } catch (err) {}
                }
            };

            track0.addEventListener('pointerdown', down);
            track0.addEventListener('pointermove', moveEvt);
            track0.addEventListener('pointerup', up);
            track0.addEventListener('pointercancel', up);
            track0.addEventListener('lostpointercapture', up);

            if (typeof ResizeObserver !== 'undefined') {
                const ro = new ResizeObserver(() => {
                    if (!track0.isConnected) { ro.disconnect(); return; }
                    maRelayout();
                });
                ro.observe(track0);
            }
        }

        // Aperçu : frise horaire du jour (tâches occupées en gris, jeton bleu pour
        // le créneau choisi, repère « maintenant »), statut d'une ligne, pastilles.
        function renderColumnMovePreview() {
            const box = document.getElementById('move-adapt-preview');
            const pending = _pendingColumnMove;
            if (!box || !pending) return;
            const card = state.cards.find(c => c.id === pending.cardId);
            const toCol = state.columns.find(c => c.id === pending.toColumnId);
            if (!card || !toCol) return;

            const dateStr = (document.getElementById('move-adapt-date') || {}).value || '';
            const timeStr = (document.getElementById('move-adapt-time') || {}).value || '';
            const duration = getMoveDuration(card);
            const span = MA_DAY_END - MA_DAY_START;
            const pct = m => Math.max(0, Math.min(100, ((m - MA_DAY_START) / span) * 100));

            let html = '';

            // --- Frise 8h → 22h ---
            if (dateStr) {
                let ticks = '';
                for (let h = 8; h <= 22; h += 2) {
                    const hourStyle = h === 8
                        ? 'left:4px;transform:none'
                        : (h === 22 ? 'left:calc(100% - 4px);transform:translateX(-100%)' : `left:${pct(h * 60)}%`);
                    ticks += `<div class="ma-tick" style="left:${pct(h * 60)}%"></div><div class="ma-hour" style="${hourStyle}">${h}h</div>`;
                }
                let bi = 0;
                const busy = state.cards.filter(c => {
                    if (c.id === card.id) return false;
                    const col = state.columns.find(x => x.id === c.columnId);
                    if (isCompletedColumn(col)) return false;
                    const w = getCardTimeWindow(c);
                    return w && w.date === dateStr;
                }).map(c => {
                    const w = getCardTimeWindow(c);
                    const left = pct(w.start);
                    const width = Math.max(1.6, pct(w.end) - left);
                    const label = width >= 15 ? escapeHtml(formatTimeWindow(w)) : '';
                    return `<div class="ma-busy" style="left:${left}%;width:${width}%;animation-delay:${bi++ * 40}ms" title="${escapeHtml(c.title)} · ${escapeHtml(formatTimeWindow(w))}">${label}</div>`;
                }).join('');
                let nowLine = '';
                if (dateStr === localDateStr(new Date())) {
                    const n = new Date();
                    nowLine = `<div class="ma-now" style="left:${pct(n.getHours() * 60 + n.getMinutes())}%"></div>`;
                }
                let ev = '';
                if (timeStr) {
                    const s = maClampSnap(timeToMins(timeStr), duration, 1);
                    const ko = checkTimelineCollisions({ startDate: dateStr, deadline: null, scheduledTime: timeStr, duration: duration }, card.id).length > 0;
                    const chipWidth = Math.max(3.2, Math.min(100, (duration / span) * 100));
                    ev = `<div class="ma-chip-ev${ko ? ' ko' : ''}" data-mins="${s}" style="width:${chipWidth}%"><div class="ma-bubble${ko ? ' ko' : ''}">${escapeHtml(timeStr)}</div><i></i></div>`;
                }
                html += `<div class="ma-tl">${ticks}${busy}${nowLine}${ev}</div>`;
            }

            html += maStatusHTML(dateStr, timeStr, duration, card, toCol);

            // --- Créneaux libres en pastilles ---
            if (dateStr) {
                const slots = findFreeTimeSlots(dateStr, duration, card.id) || [];
                if (slots.length) {
                    html += `<div class="ma-slots">${slots.map(sl => {
                        const f = formatTimeWindowFromMins(sl.start, sl.end);
                        return `<button type="button" class="ma-slot${f.startStr === timeStr ? ' on' : ''}" data-start="${escapeHtml(f.startStr)}" onclick="pickMoveTimeSuggestion('${f.startStr}')">${escapeHtml(f.text.replace(' - ', '–'))}</button>`;
                    }).join('')}</div>`;
                }
            }

            box.innerHTML = html;
            wireTimeline();

            // Position initiale du jeton, sans transition (avant le premier paint).
            _maLastKey = dateStr + '|' + timeStr;
            const placed = maElements();
            if (placed && timeStr) {
                const s = maClampSnap(timeToMins(timeStr), duration, 1);
                placed.chip.dataset.mins = String(s);
                placed.chip.style.transform = 'translate3d(' + maX(placed.track, s) + 'px,0,0)';
            }
        }

        // La ligne de statut : une icône + quelques mots, jamais plus.
        function maStatusHTML(dateStr, timeStr, duration, card, toCol) {
            const ICONS = {
                ok: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
                ko: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
                warn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>'
            };
            if (!dateStr) return `<div class="ma-status warn" id="ma-status">${ICONS.warn} Sans date</div>`;
            if (!timeStr) return `<div class="ma-status warn" id="ma-status">${ICONS.warn} Sans heure — cliquez sur la frise</div>`;
            const conflicts = checkTimelineCollisions({ startDate: dateStr, deadline: null, scheduledTime: timeStr, duration: duration }, card.id);
            const autoRole = getTargetColumnForDate(dateStr);
            const autoCol = findColumnByRole(autoRole);
            const mismatch = autoCol && autoCol.id !== toCol.id && getColumnMoveRole(autoCol) === autoRole && !isCompletedColumn(toCol);
            if (conflicts.length) {
                const names = conflicts.map(c => c.title).join(', ');
                const t0 = conflicts[0].title;
                return `<div class="ma-status ko" id="ma-status" title="${escapeHtml(names)}">${ICONS.ko} Chevauche « ${escapeHtml(t0.length > 26 ? t0.slice(0, 25) + '…' : t0)} »${conflicts.length > 1 ? ' +' + (conflicts.length - 1) : ''}</div>`;
            }
            if (mismatch) return `<div class="ma-status warn" id="ma-status">${ICONS.warn} Sera reclassée dans « ${escapeHtml(autoCol.title)} »</div>`;
            const end = formatTimeWindowFromMins(timeToMins(timeStr), timeToMins(timeStr) + duration).text.split(' - ')[1];
            return `<div class="ma-status ok" id="ma-status">${ICONS.ok} ${escapeHtml(timeStr)} – ${escapeHtml(end)}</div>`;
        }

        function pickMoveTimeSuggestion(timeStr) {
            maSetTime(timeToMins(timeStr), true);
        }

        // adapt = true  → applique la date et l'heure saisies dans le pop-up
        // adapt = false → déplace la carte en conservant sa date et son heure
        function confirmColumnMove(adapt) {
            const pending = _pendingColumnMove;
            _pendingColumnMove = null;
            if (!pending) { closeModal(); return; }

            const card = state.cards.find(c => c.id === pending.cardId);
            const toCol = state.columns.find(c => c.id === pending.toColumnId);
            if (!card || !toCol) { closeModal(); renderBoardImmediate(); return; }

            const dateInput = document.getElementById('move-adapt-date');
            const timeInput = document.getElementById('move-adapt-time');
            let toast = `Déplacée vers « ${escapeHtml(toCol.title)} »`;

            if (adapt) {
                const newDate = dateInput && dateInput.value ? dateInput.value : null;
                const newTime = timeInput && timeInput.value ? timeInput.value : null;
                card.startDate = newDate;
                card.scheduledTime = newTime;
                toast += newDate
                    ? ` · ${escapeHtml(prettyMoveDate(newDate, 'short'))}${newTime ? ' à ' + escapeHtml(newTime) : ''}`
                    : ' · sans date';
            } else {
                toast += ' · date et heure conservées';
            }

            card.columnId = pending.toColumnId;
            _cardsIndexDirty = true;
            saveState();
            closeModal();
            renderBoardImmediate();
            updateStats();
            if (typeof refreshNowFocusWidgets === 'function') refreshNowFocusWidgets();
            showToast(toast);

            if (!adapt && !isCompletedColumn(toCol)) {
                const autoRole = getTargetColumnForDate(card.startDate || card.deadline);
                const autoCol = findColumnByRole(autoRole);
                if (autoCol && autoCol.id !== card.columnId && getColumnMoveRole(autoCol) === autoRole) {
                    showToast(`Date conservée — l'automatisation pourra la redéplacer vers « ${escapeHtml(autoCol.title)} »`);
                }
            }
        }

        // Fermer le pop-up sans valider = la carte retourne dans sa colonne.
        function cancelColumnMove() {
            const pending = _pendingColumnMove;
            _pendingColumnMove = null;
            closeModal();
            renderBoardImmediate();
            if (pending) {
                const fromCol = state.columns.find(c => c.id === pending.fromColumnId);
                showToast('Déplacement annulé' + (fromCol ? ` — tâche remise dans « ${escapeHtml(fromCol.title)} »` : ''));
            }
        }

        function showHierMoveModal(cardId, targetColumnId) {
            const card = state.cards.find(c => c.id === cardId);
            if (!card) return;
            const yStr = getYesterdayStr();
            const prettyY = (()=>{ const d=parseLocalDate(yStr); return d? d.toLocaleDateString('fr-FR') : yStr; })();
            const modal = createModal('Déplacer vers Hier', `
                <p style="margin-bottom:var(--space-3); font-size:15px; color:var(--ink-soft); line-height:1.4;">
                    La tâche <strong style="color:var(--ink);">${escapeHtml(card.title)}</strong> n'est pas datée d'hier.<br>
                    Voulez-vous adapter sa date ?
                </p>
                <div style="display:flex; flex-direction:column; gap:var(--space-2);">
                    <div style="padding:10px 12px; background:var(--bg-alt); border-radius:var(--radius); font-size:13px; color:var(--ink-soft); border:1px solid var(--line);">Date actuelle : <strong style="color:var(--ink);">${escapeHtml(card.startDate || 'aucune')}</strong></div>
                </div>
            `, [
                { text: 'Garder la date', class: 'btn-secondary', onclick: `confirmHierMove(${cardId}, ${targetColumnId}, false)` },
                { text: `Adapter à hier (${prettyY})`, class: 'btn-primary', onclick: `confirmHierMove(${cardId}, ${targetColumnId}, true)` }
            ]);
            document.body.appendChild(modal);
        }

        function confirmHierMove(cardId, targetColumnId, adaptDate) {
            const card = state.cards.find(c => c.id === cardId);
            if (!card) { closeModal(); return; }
            if (adaptDate) {
                card.startDate = getYesterdayStr();
                showToast('Date adaptée à hier');
            } else {
                showToast('Date conservée — l\'automatisation pourra la redéplacer');
            }
            card.columnId = targetColumnId;
            saveState();
            closeModal();
            renderBoard();
            updateStats();
        }

        function getIncompleteRequiredCount(card) {
            const r = canCompleteTask(card);
            return r.ok ? 0 : r.count;
        }

        // =========== RENDER BOARD ============


        // =========== MAINTENANT — MOTEUR DE FOCUS ============
        // La sélection privilégie l'intention réelle : travail chronométré,
        // créneau actif, échéance en retard, puis prochaine action du jour.
        const NOW_FOCUS_ICONS = {
            play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="7 4 19 12 7 20 7 4"/></svg>',
            pause: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>',
            timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M9 2h6M12 2v3"/></svg>',
            alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
            focus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>',
            spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/></svg>',
            calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
            duration: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
            clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
        };

        function focusPriorityValue(card) {
            return ({ high: 3, medium: 2, low: 1 })[card && card.priority] || 0;
        }

        function focusTimeToMinutes(time) {
            if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return null;
            const [hour, minute] = time.split(':').map(Number);
            if (hour > 23 || minute > 59 || hour < 0 || minute < 0) return null;
            return hour * 60 + minute;
        }

        function getFocusCardDate(card) {
            return card.startDate || card.deadline || null;
        }

        function isIncompleteFocusCard(card) {
            if (!card) return false;
            const column = state.columns.find(col => col.id === card.columnId);
            return !isCompletedColumn(column);
        }

        function isCardRelevantForFocusDate(card, dateStr, todayStr) {
            const cardDate = getFocusCardDate(card);
            if (cardDate === dateStr) return true;
            // Les tâches sans date de la colonne Aujourd'hui font bien partie
            // de la journée actuelle, même sans créneau horaire.
            if (!cardDate && dateStr === todayStr) {
                const column = state.columns.find(col => col.id === card.columnId);
                return isTodayColumn(column);
            }
            return false;
        }

        function getFocusTimeRange(card) {
            if (!card || !card.scheduledTime) return '';
            const start = focusTimeToMinutes(card.scheduledTime);
            if (start === null) return `Prévue à ${card.scheduledTime}`;
            const duration = Math.max(1, Number(card.duration) || 60);
            const end = Math.min((24 * 60) - 1, start + duration);
            const endHours = String(Math.floor(end / 60)).padStart(2, '0');
            const endMinutes = String(end % 60).padStart(2, '0');
            return `${card.scheduledTime} – ${endHours}:${endMinutes}`;
        }

        function getFocusStartDateDetails(dateStr) {
            const date = parseLocalDate(dateStr);
            if (!date) return { short: dateStr || '', long: dateStr || '' };
            const short = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
                .format(date)
                .replace(/\.$/, '');
            const long = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
            return { short, long };
        }

        function formatAmPmTime(timeValue) {
            const match = String(timeValue || '').match(/^(\d{1,2}):(\d{2})$/);
            if (!match) return String(timeValue || '');
            const hour24 = Number(match[1]);
            const minute = match[2];
            if (hour24 > 23 || hour24 < 0) return String(timeValue || '');
            const period = hour24 >= 12 ? 'PM' : 'AM';
            const hour12 = hour24 % 12 || 12;
            return `${String(hour12).padStart(2, '0')}:${minute} ${period}`;
        }

        function getNowFocusSchedule(card) {
            if (!card) return { html: '', label: '' };
            const items = [];
            const labels = [];

            if (card.startDate) {
                const date = getFocusStartDateDetails(card.startDate);
                labels.push(`Date de début : ${date.long}`);
                items.push(`<span class="now-focus-schedule-item" aria-label="Date de début : ${escapeHtml(date.long)}" title="Date de début : ${escapeHtml(date.long)}">${NOW_FOCUS_ICONS.calendar}<span>Déb. ${escapeHtml(date.short)}</span></span>`);
            }

            if (card.scheduledTime) {
                const startTime = formatAmPmTime(card.scheduledTime);
                labels.push(`Heure de début : ${startTime}`);
                items.push(`<span class="now-focus-schedule-item" aria-label="Heure de début : ${escapeHtml(startTime)}" title="Heure de début : ${escapeHtml(startTime)}">${NOW_FOCUS_ICONS.clock}<span>${escapeHtml(startTime)}</span></span>`);
            }

            if (card.duration && Number(card.duration) > 0) {
                const duration = formatDuration(Number(card.duration));
                labels.push(`Durée estimée : ${duration}`);
                items.push(`<span class="now-focus-schedule-item" aria-label="Durée estimée : ${escapeHtml(duration)}" title="Durée estimée : ${escapeHtml(duration)}">${NOW_FOCUS_ICONS.duration}<span>${escapeHtml(duration)}</span></span>`);
            }

            return { html: items.join(''), label: labels.join(' · ') };
        }

        function compareFocusCards(a, b) {
            const priorityDiff = focusPriorityValue(b) - focusPriorityValue(a);
            if (priorityDiff) return priorityDiff;
            const timeA = focusTimeToMinutes(a.scheduledTime) ?? Number.MAX_SAFE_INTEGER;
            const timeB = focusTimeToMinutes(b.scheduledTime) ?? Number.MAX_SAFE_INTEGER;
            if (timeA !== timeB) return timeA - timeB;
            return String(a.title || '').localeCompare(String(b.title || ''), 'fr');
        }

        /**
         * Retourne une seule tâche de focus. Dans une Journée autre qu'aujourd'hui,
         * on affiche la première action planifiée pour cette date au lieu d'une
         * fausse notion de "maintenant".
         */
        function getNowFocusTask(dateStr = localDateStr(), options = {}) {
            const now = new Date();
            const todayStr = localDateStr(now);
            const isCurrentDay = dateStr === todayStr;
            const nowMinutes = now.getHours() * 60 + now.getMinutes();
            const incomplete = state.cards.filter(isIncompleteFocusCard);
            const dayCards = incomplete.filter(card => isCardRelevantForFocusDate(card, dateStr, todayStr));

            if (isCurrentDay && options.includeLiveTimers !== false) {
                const running = incomplete
                    .filter(card => isTimerRunning(card.id))
                    .sort((a, b) => (activeTimers[b.id]?.startTime || 0) - (activeTimers[a.id]?.startTime || 0));
                if (running[0]) return { card: running[0], kind: 'running', dateStr, isCurrentDay };

                const paused = incomplete
                    .filter(card => isTimerPaused(card.id))
                    .sort((a, b) => getTimerElapsed(b.id) - getTimerElapsed(a.id));
                if (paused[0]) return { card: paused[0], kind: 'paused', dateStr, isCurrentDay };
            }

            // Dans l'historique ou le futur, le bloc devient "Au programme".
            if (!isCurrentDay && options.dayContext) {
                const scheduled = dayCards.filter(card => focusTimeToMinutes(card.scheduledTime) !== null)
                    .sort((a, b) => (focusTimeToMinutes(a.scheduledTime) - focusTimeToMinutes(b.scheduledTime)) || compareFocusCards(a, b));
                if (scheduled[0]) return { card: scheduled[0], kind: 'day', dateStr, isCurrentDay };
                const first = [...dayCards].sort(compareFocusCards)[0];
                return first ? { card: first, kind: 'day', dateStr, isCurrentDay } : { card: null, kind: 'empty', dateStr, isCurrentDay };
            }

            const currentSlot = dayCards
                .filter(card => {
                    const start = focusTimeToMinutes(card.scheduledTime);
                    if (start === null) return false;
                    const duration = Math.max(1, Number(card.duration) || 60);
                    return nowMinutes >= start && nowMinutes < start + duration;
                })
                .sort((a, b) => compareFocusCards(a, b) || (focusTimeToMinutes(b.scheduledTime) - focusTimeToMinutes(a.scheduledTime)));
            if (currentSlot[0]) return { card: currentSlot[0], kind: 'current', dateStr, isCurrentDay };

            const overdue = incomplete
                .filter(card => getDeadlineStatus(card.deadline, card.scheduledTime) === 'overdue')
                .sort((a, b) => {
                    const priorityDiff = focusPriorityValue(b) - focusPriorityValue(a);
                    if (priorityDiff) return priorityDiff;
                    return String(a.deadline || '').localeCompare(String(b.deadline || ''));
                });
            if (overdue[0]) return { card: overdue[0], kind: 'overdue', dateStr, isCurrentDay };

            const missedSlot = dayCards
                .filter(card => {
                    const start = focusTimeToMinutes(card.scheduledTime);
                    if (start === null) return false;
                    const duration = Math.max(1, Number(card.duration) || 60);
                    return nowMinutes >= start + duration;
                })
                .sort((a, b) => (focusTimeToMinutes(a.scheduledTime) - focusTimeToMinutes(b.scheduledTime)) || compareFocusCards(a, b));
            if (missedSlot[0]) return { card: missedSlot[0], kind: 'missed', dateStr, isCurrentDay };

            const nextSlot = dayCards
                .filter(card => {
                    const start = focusTimeToMinutes(card.scheduledTime);
                    return start !== null && start > nowMinutes;
                })
                .sort((a, b) => (focusTimeToMinutes(a.scheduledTime) - focusTimeToMinutes(b.scheduledTime)) || compareFocusCards(a, b));
            if (nextSlot[0]) return { card: nextSlot[0], kind: 'next', dateStr, isCurrentDay };

            const todayTask = [...dayCards].sort(compareFocusCards)[0];
            if (todayTask) return { card: todayTask, kind: 'today', dateStr, isCurrentDay };

            return { card: null, kind: 'empty', dateStr, isCurrentDay };
        }

        function getNowFocusCopy(focus) {
            const card = focus.card;
            if (!card) {
                return {
                    eyebrow: focus.isCurrentDay ? 'Maintenant' : 'Au programme',
                    title: focus.isCurrentDay ? 'Rien d’urgent à faire' : 'Journée libre',
                    meta: focus.isCurrentDay ? 'Choisissez votre prochaine priorité.' : 'Aucune tâche planifiée pour ce jour.',
                    icon: NOW_FOCUS_ICONS.spark,
                    action: 'Planifier'
                };
            }

            const category = card.category ? ` · ${card.category}` : '';
            const priority = priorityLabels[card.priority] ? ` · Priorité ${priorityLabels[card.priority].toLowerCase()}` : '';
            const range = getFocusTimeRange(card);
            const scheduledMeta = range ? `${range}${category}` : `${card.category || 'Tâche du jour'}${priority}`;

            const copyByKind = {
                running: { eyebrow: 'Maintenant · en cours', meta: `Chronomètre en marche${range ? ` · ${range}` : ''}${category}`, icon: NOW_FOCUS_ICONS.timer, action: 'Mettre en pause' },
                paused: { eyebrow: 'Maintenant · à reprendre', meta: `Chronomètre en pause${range ? ` · ${range}` : ''}${category}`, icon: NOW_FOCUS_ICONS.timer, action: 'Reprendre' },
                current: { eyebrow: 'Maintenant · créneau actif', meta: scheduledMeta, icon: NOW_FOCUS_ICONS.focus, action: 'Démarrer' },
                overdue: { eyebrow: 'À traiter en priorité', meta: `Échéance dépassée${card.deadline ? ` · ${card.deadline}` : ''}${category}`, icon: NOW_FOCUS_ICONS.alert, action: 'Démarrer' },
                missed: { eyebrow: 'Créneau à reprendre', meta: `Prévue ${range || 'plus tôt'}${category}`, icon: NOW_FOCUS_ICONS.alert, action: 'Démarrer' },
                next: { eyebrow: 'Prochaine étape', meta: `Prévue ${scheduledMeta}`, icon: NOW_FOCUS_ICONS.timer, action: 'Démarrer' },
                day: { eyebrow: 'Au programme', meta: scheduledMeta, icon: NOW_FOCUS_ICONS.focus, action: 'Démarrer' },
                today: { eyebrow: 'À faire aujourd’hui', meta: scheduledMeta, icon: NOW_FOCUS_ICONS.focus, action: 'Démarrer' }
            };
            return { title: card.title, ...(copyByKind[focus.kind] || copyByKind.today) };
        }

        function renderNowFocusWidget(elementId, focus) {
            const element = document.getElementById(elementId);
            if (!element) return;
            const copy = getNowFocusCopy(focus);
            const card = focus.card;
            const isEmpty = !card;
            const stateName = focus.kind || 'empty';
            element.dataset.state = stateName;

            const title = escapeHtml(copy.title);
            const meta = escapeHtml(copy.meta);
            const eyebrow = escapeHtml(copy.eyebrow);
            const schedule = isEmpty ? { html: '', label: '' } : getNowFocusSchedule(card);
            element.classList.toggle('has-schedule', !!schedule.html);
            const actionIcon = stateName === 'running' ? NOW_FOCUS_ICONS.pause : (isEmpty ? NOW_FOCUS_ICONS.spark : NOW_FOCUS_ICONS.play);
            const action = isEmpty
                ? `onclick="addTaskFromNowFocus(event, '${focus.dateStr || localDateStr()}')" aria-label="Planifier une nouvelle tâche"`
                : `onclick="activateNowFocusTask(${Number(card.id)}, event)" aria-label="${escapeHtml(copy.action)} : ${title}"`;
            const content = isEmpty
                ? '<div class="now-focus-content" aria-label="Aucune tâche urgente">'
                : `<button type="button" class="now-focus-content" onclick="showTaskSummary(${Number(card.id)})" aria-label="Ouvrir la tâche : ${escapeHtml(copy.title)}${schedule.label ? ` — ${escapeHtml(schedule.label)}` : ''}">`;
            const contentClose = isEmpty ? '</div>' : '</button>';

            element.innerHTML = `
                <div class="now-focus-shell">
                    <div class="now-focus-marker">${copy.icon}</div>
                    ${content}
                        <span class="now-focus-eyebrow"><span class="now-focus-dot"></span>${eyebrow}</span>
                        <span class="now-focus-title">${title}</span>
                        ${schedule.html ? `<span class="now-focus-schedule">${schedule.html}</span>` : ''}
                        <span class="now-focus-meta">${NOW_FOCUS_ICONS.timer}<span class="now-focus-meta-text">${meta}</span></span>
                    ${contentClose}
                    <button type="button" class="now-focus-action" ${action}>${actionIcon}<span>${escapeHtml(copy.action)}</span></button>
                </div>
            `;
        }

        function suggestedNowFocusTime() {
            const now = new Date();
            const rounded = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15;
            const safeMinutes = Math.min(23 * 60 + 45, rounded);
            return `${String(Math.floor(safeMinutes / 60)).padStart(2, '0')}:${String(safeMinutes % 60).padStart(2, '0')}`;
        }

        function addTaskFromNowFocus(event, dateStr) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            showAddCardModalAt(dateStr || localDateStr(), suggestedNowFocusTime());
        }

        function activateNowFocusTask(cardId, event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            const card = state.cards.find(item => item.id === cardId);
            if (!card || !isIncompleteFocusCard(card)) return;
            if (isTimerRunning(cardId)) pauseTimer(cardId);
            else startTimer(cardId);
            setTimeout(refreshNowFocusWidgets, 0);
        }

        function refreshNowFocusWidgets() {
            renderNowFocusWidget('header-now-focus', getNowFocusTask());
            const dayOverlay = document.getElementById('day-container');
            if (dayOverlay && dayOverlay.classList.contains('open')) {
                const activeDate = localDateStr(currentDayDate);
                renderNowFocusWidget('day-now-focus', getNowFocusTask(activeDate, {
                    includeLiveTimers: activeDate === localDateStr(),
                    dayContext: true
                }));
            }
        }

                let _skipEntranceAnimation = false;
        let _boardMounted = false;
        let _boardNeedsRender = false;

        // === OPTIMISATION PATCH — DEBUGGER AGENT ===
        const MAX_CARDS_INITIAL = 50;
        const CARDS_BATCH = 40;
        let _cardsByColumnCache = new Map();
        let _cardsMapCache = new Map();
        let _searchCache = new Map();
        let _sortableInstances = new Map();
        let _renderBoardScheduled = false;
        let _columnVisibleCount = new Map();
        let _boardRenderVersion = 0;
        let _cardsIndexDirty = true;

        function buildCardsIndex() {
            _cardsByColumnCache.clear();
            _cardsMapCache.clear();
            _searchCache.clear();
            for (const col of state.columns) {
                _cardsByColumnCache.set(col.id, []);
            }
            for (const card of state.cards) {
                const arr = _cardsByColumnCache.get(card.columnId);
                if (arr) arr.push(card);
                else _cardsByColumnCache.set(card.columnId, [card]);
                _cardsMapCache.set(card.id, card);
                const searchText = [
                    card.title || '',
                    card.description || '',
                    card.category || '',
                    card.startDate || '',
                    card.deadline || '',
                    (card.checklist || []).map(i => i.text).join(' ')
                ].join(' ').toLowerCase();
                _searchCache.set(card.id, searchText);
            }
            _cardsIndexDirty = false;
        }

        function getCardsForColumnSorted(columnId) {
            if (_cardsIndexDirty) buildCardsIndex();
            let cards = _cardsByColumnCache.get(columnId) || [];
            if (cards.length > 1) {
                cards = cards.slice().sort((a, b) => {
                    if (a.startDate && b.startDate) {
                        if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
                        const timeA = a.scheduledTime || '23:59';
                        const timeB = b.scheduledTime || '23:59';
                        return timeA.localeCompare(timeB);
                    }
                    if (a.startDate) return -1;
                    if (b.startDate) return 1;
                    return 0;
                });
            }
            return cards;
        }

        function scheduleRenderBoard() {
            if (_renderBoardScheduled) return;
            _renderBoardScheduled = true;
            requestAnimationFrame(() => {
                _renderBoardScheduled = false;
                renderBoardImmediate();
            });
        }

        function renderBoardImmediate() {
            _boardRenderVersion++;
            renderBoard();
        }

        function loadMoreCards(columnId) {
            const current = _columnVisibleCount.get(columnId) || MAX_CARDS_INITIAL;
            _columnVisibleCount.set(columnId, current + CARDS_BATCH);
            const board = document.getElementById('board');
            if (!board) return;
            const column = state.columns.find(c => c.id === columnId);
            if (!column) return;
            const oldEl = board.querySelector(`.column[data-column-id="${columnId}"]`);
            if (!oldEl) return;
            const scrollTop = oldEl.querySelector('.column-cards')?.scrollTop || 0;
            const newEl = createColumnElement(column);
            const oldFilterBar = oldEl.querySelector('.column-filter-bar');
            const newFilterBar = newEl.querySelector('.column-filter-bar');
            if (oldFilterBar && newFilterBar) {
                newFilterBar.className = oldFilterBar.className;
                newFilterBar.style.display = oldFilterBar.style.display;
                ['search','date-start','date-end','priority','status'].forEach(suffix => {
                    const oldIn = oldEl.querySelector(`#filter-${suffix}-${columnId}`);
                    const newIn = newEl.querySelector(`#filter-${suffix}-${columnId}`);
                    if (oldIn && newIn) newIn.value = oldIn.value;
                });
            }
            board.replaceChild(newEl, oldEl);
            const newScrollEl = newEl.querySelector('.column-cards');
            if (newScrollEl) newScrollEl.scrollTop = scrollTop;
            initSortableForColumn(columnId);
            if (activeStatFilter) applyStatFilter();

            attachVirtualScrollListeners();
        }

        function resetVisibleCounts() {
            for (const col of state.columns) {
                if (!_columnVisibleCount.has(col.id)) {
                    _columnVisibleCount.set(col.id, MAX_CARDS_INITIAL);
                }
            }
            for (const key of Array.from(_columnVisibleCount.keys())) {
                if (!state.columns.some(c => c.id === key)) _columnVisibleCount.delete(key);
            }
        }

                function renderBoard() {
            // Pop-up de déplacement ouvert : l'affichage du tableau est figé pour
            // que la carte reste visuellement là où elle vient d'être déposée.
            // La validation ou l'annulation du pop-up déclenchera le rendu.
            if (_pendingColumnMove) { _boardNeedsRender = true; return; }
            renderNowFocusWidget('header-now-focus', getNowFocusTask());
            syncStatColors();
            if (currentView === 'calendar') {
                _boardNeedsRender = true;
                renderCalendar();
                return;
            }
            const _boardContainer = document.querySelector('.board-container');
            if (_boardContainer && (_boardContainer.classList.contains('is-hidden') || _boardContainer.style.display === 'none')) {
                _boardNeedsRender = true;
                return;
            }
            try {
                const board = document.getElementById('board');
                if (!board) return;
                const skipAnimation = _skipEntranceAnimation;
                _skipEntranceAnimation = false;
                const playEntrance = !skipAnimation && !_boardMounted;
                if (_cardsIndexDirty) buildCardsIndex();
                resetVisibleCounts();

                // Préserve scroll ET état des filtres (ouvert/fermé + valeurs)
                const colScrolls = new Map();
                const filterStates = new Map();
                board.querySelectorAll('.column').forEach(colEl => {
                    const colId = colEl.dataset.columnId;
                    const cardsEl = colEl.querySelector('.column-cards');
                    if (cardsEl && cardsEl.scrollTop > 0) colScrolls.set(colId, cardsEl.scrollTop);
                    const filterBar = colEl.querySelector('.column-filter-bar');
                    if (filterBar) {
                        filterStates.set(colId, {
                            className: filterBar.className,
                            display: filterBar.style.display,
                            search: colEl.querySelector(`#filter-search-${colId}`)?.value || '',
                            dateStart: colEl.querySelector(`#filter-date-start-${colId}`)?.value || '',
                            dateEnd: colEl.querySelector(`#filter-date-end-${colId}`)?.value || '',
                            priority: colEl.querySelector(`#filter-priority-${colId}`)?.value || '',
                            status: colEl.querySelector(`#filter-status-${colId}`)?.value || ''
                        });
                    }
                });
                const boardScrollLeft = board.scrollLeft, boardScrollTop = board.scrollTop;

                const fragment = document.createDocumentFragment();
                state.columns.forEach((column, colIndex) => {
                    const colEl = createColumnElement(column);
                    if (playEntrance) {
                        colEl.classList.add('column-enter');
                        colEl.style.setProperty('--col-stagger-delay', `${colIndex * 60}ms`);
                    }
                    // Restaure état filtre
                    const saved = filterStates.get(String(column.id));
                    if (saved) {
                        const fb = colEl.querySelector('.column-filter-bar');
                        if (fb) {
                            fb.className = saved.className;
                            fb.style.display = saved.display;
                            const s = colEl.querySelector(`#filter-search-${column.id}`);
                            if (s) s.value = saved.search;
                            const ds = colEl.querySelector(`#filter-date-start-${column.id}`);
                            if (ds) ds.value = saved.dateStart;
                            const de = colEl.querySelector(`#filter-date-end-${column.id}`);
                            if (de) de.value = saved.dateEnd;
                            const pr = colEl.querySelector(`#filter-priority-${column.id}`);
                            if (pr) pr.value = saved.priority;
                            const st = colEl.querySelector(`#filter-status-${column.id}`);
                            if (st) st.value = saved.status;
                        }
                    }
                    fragment.appendChild(colEl);
                });

                board.innerHTML = '';
                board.appendChild(fragment);

                colScrolls.forEach((top, colId) => {
                    const el = board.querySelector(`.column-cards[data-column-id="${colId}"]`);
                    if (el) el.scrollTop = top;
                });
                if (boardScrollLeft > 0 || boardScrollTop > 0) {
                    board.scrollLeft = boardScrollLeft;
                    board.scrollTop = boardScrollTop;
                }
                if (playEntrance) {
                    document.querySelectorAll('.column').forEach(colEl => {
                        const cards = colEl.querySelectorAll('.card');
                        const limit = Math.min(cards.length, 20);
                        for (let i = 0; i < limit; i++) {
                            cards[i].classList.add('card-enter');
                            cards[i].style.setProperty('--stagger-delay', `${i * 25}ms`);
                        }
                    });
                }
                _boardMounted = true;
                initSortableOptimized();
                updateDeadlineAlertsOptimized();
                if (activeStatFilter) {
                    applyStatFilter();
                    updateStatFilterUI();
                } else {
                    // Ré-applique les filtres colonne si présents
                    for (const [colId, f] of filterStates.entries()) {
                        if (f.search || f.dateStart || f.dateEnd || f.priority || f.status) {
                            applyColumnFilterOptimized(parseInt(colId));
                        }
                    }
                }
                attachVirtualScrollListeners();
            } catch (error) {
                console.error('Erreur rendu:', error);
            }
        }


        function createColumnElement(column) {
            const columnEl = document.createElement('div');
            columnEl.className = 'column';
            columnEl.dataset.columnId = column.id;
            const allCards = getCardsForColumnSorted(column.id);
            const visibleCount = _columnVisibleCount.get(column.id) || MAX_CARDS_INITIAL;
            const cards = allCards.slice(0, visibleCount);
            const hasMore = allCards.length > visibleCount;
            const remaining = allCards.length - visibleCount;
            columnEl.innerHTML = `
                <div class="column-header">
                    <div class="column-title-wrap">
                        <span class="column-color-bar" style="background:${column.color || '#6E6E73'}" onclick="event.stopPropagation();changeColumnColor(${column.id})" title="Changer la couleur"></span>
                        <div class="column-title" onclick="startEditColumnTitle(${column.id})">${escapeHtml(column.title)} <span style="font-weight:400; opacity:0.6; font-size:12px;">(${allCards.length})</span></div>
                    </div>
                    <div class="column-actions">
                        <button class="column-btn column-btn-filter" onclick="event.stopPropagation();toggleColumnFilter(${column.id})" title="Filtrer" id="filter-btn-${column.id}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                        </button>
                        <button class="column-btn" onclick="startEditColumnTitle(${column.id})" title="Renommer">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="column-btn" onclick="deleteColumn(${column.id})" title="Supprimer">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </button>
                    </div>
                </div>
                <div class="column-filter-bar filter-bar-closed" id="filter-bar-${column.id}" style="display:none;">
                    <div class="filter-search-wrap">
                        <svg class="filter-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" class="filter-search-input" id="filter-search-${column.id}" placeholder="Rechercher..." oninput="applyColumnFilterOptimized(${column.id})">
                    </div>
                    <div class="filter-date-row">
                        <input type="date" class="filter-date-input" id="filter-date-start-${column.id}" onchange="applyColumnFilterOptimized(${column.id})" title="Du">
                        <input type="date" class="filter-date-input" id="filter-date-end-${column.id}" onchange="applyColumnFilterOptimized(${column.id})" title="Au">
                    </div>
                    <div class="filter-options-row">
                        <select class="filter-select" id="filter-priority-${column.id}" onchange="applyColumnFilterOptimized(${column.id})">
                            <option value="">Toute priorité</option>
                            <option value="high">Haute</option>
                            <option value="medium">Moyenne</option>
                            <option value="low">Basse</option>
                        </select>
                        <select class="filter-select" id="filter-status-${column.id}" onchange="applyColumnFilterOptimized(${column.id})">
                            <option value="">Tout statut</option>
                            <option value="overdue">En retard</option>
                            <option value="soon">Bientôt</option>
                            <option value="none">Normal</option>
                        </select>
                        <button class="filter-clear-btn" onclick="clearColumnFilterOptimized(${column.id})" title="Effacer les filtres"><svg style="width:12px;height:12px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
                    </div>
                </div>
                <div class="column-cards" data-column-id="${column.id}">
                    ${cards.length === 0 && allCards.length === 0 ? '<div class="empty-column"><svg style="display:block;margin:0 auto 8px;opacity:0.25" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="13" y2="13"/></svg>Aucune tâche</div>' : ''}
                    ${cards.map(card => createCardHTML(card)).join('')}
                    ${hasMore ? `<button class="load-more-btn" onclick="loadMoreCards(${column.id})">Charger ${Math.min(remaining, CARDS_BATCH)} de plus (${remaining} restants)</button><div class="column-cards-count">${cards.length} / ${allCards.length} affichées</div>` : (allCards.length > MAX_CARDS_INITIAL ? `<div class="column-cards-count">${allCards.length} tâches</div>` : '')}
                </div>
            `;
            return columnEl;
        }





        /**
         * Résumé de carte : les URL ne doivent pas gonfler la hauteur du Kanban.
         * Elles restent intégralement visibles dans le détail de la tâche.
         */
        function getCompletionNotePreview(note) {
            const raw = String(note || '').trim();
            const links = raw.match(/https?:\/\/[^\s]+/gi) || [];
            const text = raw
                .replace(/https?:\/\/[^\s]+/gi, '')
                .replace(/\s+/g, ' ')
                .trim();
            return {
                text: text || (links.length ? 'Lien ajouté à la note' : 'Note de complétion ajoutée'),
                linkCount: links.length
            };
        }

        function createCardHTML(card) {
            const priorityClass = `badge-priority-${card.priority}`;
            let badges = `<span class="badge ${priorityClass}">${priorityLabels[card.priority]}</span>`;
            if (card.category) {
                badges += `<span class="badge badge-category" style="background: ${card.categoryColor || 'var(--bg-alt)'}; color: white;">${escapeHtml(card.category)}</span>`;
            }
            if (card.recurrence && card.recurrence.type !== 'none') {
                let recLabel = getRecurrenceBadgeLabel(card);
                if (card.recurrenceSeriesId && card.recurrenceTotal > 1) {
                    recLabel += ` · ${(card.recurrenceIndex||0)+1}/${card.recurrenceTotal}`;
                }
                badges += `<span class="badge badge-recurring" title="${escapeHtml(getRecurrenceSummary(card))}">${recLabel}</span>`;
            }

            let info = '';
            if (card.startDate) {
                info += `<div class="card-info-item">${icons.calendar}<span>${escapeHtml(card.startDate)}</span></div>`;
            }
            if (card.duration) {
                const hours = Math.floor(card.duration / 60);
                const minutes = card.duration % 60;
                let durationText = '';
                if (hours > 0) durationText += `${hours}h`;
                if (minutes > 0) durationText += `${minutes}min`;
                info += `<div class="card-info-item">${icons.clock}<span>${durationText}</span></div>`;
            }
            if (card.scheduledTime) {
                info += `<div class="card-info-item">${icons.timer}<span>${escapeHtml(card.scheduledTime)}</span></div>`;
            }
            if (card.deadline) {
                const deadlineStatus = getDeadlineStatus(card.deadline, card.scheduledTime);
                let alertIcon = '';
                if (deadlineStatus === 'overdue') alertIcon = icons.alert;
                else if (deadlineStatus === 'soon') alertIcon = icons.timer;
                info += `<div class="card-info-item">${alertIcon}<span>${escapeHtml(card.deadline)}</span></div>`;
            }

            let checklistHTML = '';
            if (card.checklist && card.checklist.length > 0) {
                const completed = card.checklist.filter(i => i.checked).length;
                const total = card.checklist.length;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                const allDone = completed === total;
                checklistHTML = `<div class="card-checklist ${allDone ? 'all-done' : ''}" onclick="event.stopPropagation(); showTaskSummary(${card.id})">
                    ${allDone ? '<span class="card-checklist-check"><svg style="width:12px;height:12px;vertical-align:-1px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>' : icons.checklist}
                    <span class="card-checklist-label">${completed}/${total} sous-tâches</span>
                    <span class="card-checklist-progress"><span class="card-checklist-progress-fill" style="width:${pct}%"></span></span>
                </div>`;
            }

            let completionNoteHTML = '';
            if (card.completionNote) {
                const notePreview = getCompletionNotePreview(card.completionNote);
                completionNoteHTML = `<div class="card-completion-note" role="button" tabindex="0" aria-label="Ouvrir la note de complétion" onclick="event.stopPropagation(); showTaskSummary(${card.id})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();showTaskSummary(${card.id})}">
                    <span class="completion-note-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>
                    <span class="completion-note-preview">${escapeHtml(notePreview.text)}</span>
                    ${notePreview.linkCount ? `<span class="completion-note-link-count">${notePreview.linkCount} lien${notePreview.linkCount > 1 ? 's' : ''}</span>` : ''}
                </div>`;
            }

            if (card.totalTimeSpent && card.totalTimeSpent > 0 && !activeTimers[card.id]) {
                info += `<div class="card-info-item">${icons.timer}<span>Temps total : ${formatTime(card.totalTimeSpent)}</span></div>`;
            }

            const deadlineClass = getDeadlineCSSClass(card.deadline, card.scheduledTime);
            const timerRunning = isTimerRunning(card.id);
            const timerPaused = isTimerPaused(card.id);
            const hasTimer = activeTimers[card.id] !== undefined;

            let timerClass = '';
            if (timerRunning) timerClass = 'timer-running';
            else if (timerPaused) timerClass = 'timer-paused';

            const isCompletedColumnCard = (() => {
                const col = state.columns.find(c => c.id === card.columnId);
                return isCompletedColumn(col);
            })();

            let timerControlsHTML = '';
            if (isCompletedColumnCard) {
                // Tâche terminée : affichage simple (pas de boutons, camembert + temps + label)
                if (card.totalTimeSpent && card.totalTimeSpent > 0) {
                    const completedCard = { ...card, duration: card.duration || Math.max(1, Math.ceil(card.totalTimeSpent / 60)) };
                    timerControlsHTML = `
                        <div class="timer-controls-visual completed-visual" style="margin-top:var(--space-3);">
                            <div class="timer-row-main">
                                ${renderTimerVisual(completedCard)}
                                <div class="timer-time-block">
                                    <div class="timer-time-big timer-time-big-value" style="color:var(--ink);">${formatTimeCompact(card.totalTimeSpent)}</div>
                                    <div class="timer-elapsed-label" style="color:var(--sys-green);"><span class="swatch" style="background:var(--sys-green);"></span>Tâche terminée</div>
                                    <div class="timer-estimate-label" style="color:var(--ink-soft);font-weight:500;text-transform:none;letter-spacing:0;font-size:11px;">temps total enregistré</div>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    timerControlsHTML = `
                        <div style="margin-top:var(--space-3);padding:var(--space-3);background:var(--bg-alt);border-radius:var(--radius);text-align:center;font-size:13px;color:var(--ink-soft);border:1px solid var(--line);">Tâche terminée</div>
                    `;
                }
            } else {
                // Carte active : deux métriques égales, un anneau de progression et une action primaire.
                const elapsed = getTimerElapsed(card.id);
                const ui = getTimerUiState(card, elapsed);
                const mainBtnIcon = ui.running
                    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4.5" width="4" height="15" rx="1.2"/><rect x="14" y="4.5" width="4" height="15" rx="1.2"/></svg>`
                    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-left:2px;" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg>`;
                const mainBtnAction = ui.running ? `pauseTimer(${card.id}, event)` : `startTimer(${card.id}, event)`;
                const mainBtnClass = ui.running ? 'timer-btn-v-pause' : 'timer-btn-v-play';
                const mainBtnTitle = ui.running ? 'Mettre en pause' : (hasTimer ? 'Reprendre' : 'Démarrer le chronomètre');
                const estimateText = ui.hasEstimate ? `Estimation · ${formatDuration(card.duration)}` : 'Sans estimation';
                const stopBtn = hasTimer
                    ? `<button class="timer-btn-v timer-btn-v-stop timer-stop-secondary" onclick="stopTimer(${card.id}, event)" title="Arrêter et enregistrer le temps" aria-label="Arrêter et enregistrer le temps">
                         <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2.5"/></svg><span>Arrêter</span>
                       </button>`
                    : '';

                timerControlsHTML = `
                    <div class="timer-controls-visual timer-experience ${ui.stateClass} ${ui.running ? 'is-running' : ''} ${ui.overtime ? 'is-overtime' : ''}" data-timer-card="${card.id}">
                        <div class="timer-row-main">
                            ${renderTimerVisual(card, elapsed)}
                            <div class="timer-time-block">
                                <div class="timer-status-line"><span class="swatch"></span><span class="timer-status-text">${escapeHtml(ui.status)}</span></div>
                                <div class="timer-dual-times" aria-label="Temps écoulé et temps restant">
                                    <div class="timer-metric">
                                        <span class="timer-metric-value timer-elapsed-value" data-card="${card.id}">${formatTimerMetric(ui.elapsed)}</span>
                                        <span class="timer-metric-label">écoulé</span>
                                    </div>
                                    <span class="timer-metric-divider" aria-hidden="true"></span>
                                    <div class="timer-metric timer-metric-remaining">
                                        <span class="timer-metric-value timer-remaining-value">${ui.hasEstimate ? formatTimerMetric(ui.remaining) : '—'}</span>
                                        <span class="timer-metric-label timer-remaining-label">${ui.hasEstimate ? 'restant' : 'sans limite'}</span>
                                    </div>
                                </div>
                            </div>
                            <button class="timer-btn-v ${mainBtnClass}" onclick="${mainBtnAction}" title="${mainBtnTitle}" aria-label="${ui.running ? 'Mettre en pause' : mainBtnTitle}">
                                ${mainBtnIcon}
                            </button>
                        </div>
                        <div class="timer-row-sub">
                            <div class="timer-estimate-label"><span class="timer-estimate-text">${escapeHtml(estimateText)}</span></div>
                            ${stopBtn}
                        </div>
                    </div>
                    <button class="btn btn-success" onclick="showCompleteTaskModal(${card.id}, event)" style="width: 100%; margin-top: var(--space-2); justify-content: center; font-size: 13px; padding: 10px 16px; border-radius: var(--radius-pill);">
                        <svg style="width:15px;height:15px;vertical-align:-2px;display:inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Terminer
                    </button>
                `;
            }

            return `
                <div class="card ${deadlineClass} ${timerClass}" data-card-id="${card.id}" onclick="showTaskSummary(${card.id})">
                    ${getDeadlineAlert(card.deadline, card.scheduledTime)}
                    <div class="card-header">
                        <div class="card-title">${escapeHtml(card.title)}</div>
                        <button class="card-menu-btn" aria-label="Menu d'actions" onclick="event.stopPropagation(); showCardMenu(event, ${card.id})">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                        </button>
                    </div>
                    ${window.vnPhotoGallery((card.photos || []).slice(0,1))}${card.description ? `<div style="font-size: 13px; color: var(--ink-soft); margin-bottom: var(--space-2); line-height: 1.4;">${escapeHtml(card.description.length > 30 ? card.description.substring(0, 30) + '...' : card.description)}</div>` : ''}
                    <div class="card-badges">${badges}</div>
                    <div class="card-info">${info}</div>
                    ${checklistHTML}
                    ${completionNoteHTML}
                    ${timerControlsHTML}
                </div>
            `;
        }

        // =========== DEADLINE ALERTS ============
        function getDeadlineStatus(deadline, scheduledTime) {
            if (!deadline) return 'none';
            const now = new Date();
            const deadlineDate = new Date(deadline);
            if (scheduledTime) {
                const [hours, minutes] = scheduledTime.split(':');
                deadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            } else {
                deadlineDate.setHours(23, 59, 59, 999);
            }
            if (deadlineDate < now) return 'overdue';
            const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
            if (deadlineDate <= twoHoursFromNow) return 'soon';
            return 'none';
        }

        function getDeadlineCSSClass(deadline, scheduledTime) {
            const status = getDeadlineStatus(deadline, scheduledTime);
            if (status === 'overdue') return 'deadline-overdue';
            if (status === 'soon') return 'deadline-soon';
            return '';
        }

        function getDeadlineAlert(deadline, scheduledTime) {
            const status = getDeadlineStatus(deadline, scheduledTime);
            if (status === 'overdue') return '<span class="deadline-alert"><svg style="width:13px;height:13px;vertical-align:-2px;display:inline-block" viewBox="0 0 24 24" fill="none" stroke="var(--sys-red)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>';
            if (status === 'soon') return '<span class="deadline-alert"><svg style="width:13px;height:13px;vertical-align:-2px;display:inline-block" viewBox="0 0 24 24" fill="none" stroke="var(--sys-orange)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>';
            return '';
        }

                function updateDeadlineAlertsOptimized() {
            document.querySelectorAll('.card').forEach(cardEl => {
                const cardId = parseInt(cardEl.dataset.cardId);
                const card = _cardsMapCache.get(cardId) || state.cards.find(c => c.id === cardId);
                if (card) {
                    const timerRunning = isTimerRunning(cardId);
                    const timerPaused = isTimerPaused(cardId);
                    let timerClass = '';
                    if (timerRunning) timerClass = 'timer-running';
                    else if (timerPaused) timerClass = 'timer-paused';
                    const baseClasses = cardEl.className.replace(/deadline-\w+|timer-\w+/g, '').trim();
                    cardEl.className = `${baseClasses} ${getDeadlineCSSClass(card.deadline, card.scheduledTime)} ${timerClass}`.trim().replace(/\s+/g, ' ');
                    const existingAlert = cardEl.querySelector('.deadline-alert');
                    if (existingAlert) existingAlert.remove();
                    const alertHTML = getDeadlineAlert(card.deadline, card.scheduledTime);
                    if (alertHTML) cardEl.insertAdjacentHTML('afterbegin', alertHTML);
                }
            });
        }
        function updateDeadlineAlerts() { return updateDeadlineAlertsOptimized(); }



        // =========== DRAG & DROP ============
                function initSortableForColumn(columnId) {
            try {
                const container = document.querySelector(`.column-cards[data-column-id="${columnId}"]`);
                if (!container) return;
                const existing = _sortableInstances.get(columnId);
                if (existing) { try { existing.destroy(); } catch(e){} }
                const sortable = new Sortable(container, {
                    group: 'cards',
                    animation: 150,
                    easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
                    ghostClass: 'dragging',
                    dragClass: 'drag-over',
                    filter: '.timer-controls, .timer-btn, .timer-display, .timer-controls-visual, .timer-btn-v, .timer-visual, .load-more-btn',
                    preventOnFilter: false,
                    delay: 80,
                    delayOnTouchOnly: true,
                    touchStartThreshold: 5,
                    onStart: function(evt) {
                        document.querySelectorAll('.card').forEach(el => el.classList.remove('drag-leave','drag-over'));
                        evt.from.classList.add('sortable-highlight');
                    },
                    onEnd: function(evt) {
                        try {
                            document.querySelectorAll('.column').forEach(el => el.classList.remove('drag-column-over'));
                            document.querySelectorAll('.column-cards').forEach(el => el.classList.remove('sortable-highlight'));
                            const cardId = parseInt(evt.item.dataset.cardId);
                            const newColumnId = parseInt(evt.to.dataset.columnId);
                            const card = _cardsMapCache.get(cardId) || state.cards.find(c => c.id === cardId);
                            if (!card) return;
                            const newCol = state.columns.find(c => c.id === newColumnId);
                            const oldCol = state.columns.find(c => c.id === card.columnId);
                            if (!newCol || card.columnId === newColumnId) { renderBoardImmediate(); return; }
                            if (isCompletedColumn(oldCol) && !isCompletedColumn(newCol)) {
                                showToast('Terminé est définitif — utilisez \'Modifier\' pour réouvrir la tâche');
                                renderBoardImmediate();
                                return;
                            }
                            // Changement de colonne : la carte n'est pas encore
                            // modifiée. Le pop-up « date + heure » prend le relais
                            // (Annuler / croix / Échap = la carte revient en place).
                            showColumnMoveModal(cardId, card.columnId, newColumnId);
                        } catch(e){ console.error(e); renderBoardImmediate(); }
                    }
                });
                _sortableInstances.set(columnId, sortable);
            } catch(error){ console.error('Erreur Sortable colonne', columnId, error); }
        }
        function initSortableOptimized() {
            try {
                for (const [colId, inst] of _sortableInstances.entries()) {
                    try { inst.destroy(); } catch(e){}
                }
                _sortableInstances.clear();
                document.querySelectorAll('.column-cards').forEach(container => {
                    const columnId = parseInt(container.dataset.columnId);
                    initSortableForColumn(columnId);
                });
                const boardEl = document.getElementById('board');
                if (boardEl) {
                    if (boardEl._sortableColumns) { try{ boardEl._sortableColumns.destroy(); }catch(e){} }
                    boardEl._sortableColumns = new Sortable(boardEl, {
                        group: 'columns',
                        animation: 200,
                        handle: '.column-header',
                        ghostClass: 'dragging',
                        onEnd: function(evt) {
                            try {
                                const newOrder = Array.from(boardEl.children).map(el => parseInt(el.dataset.columnId));
                                const map = new Map(state.columns.map(c => [c.id, c]));
                                state.columns = newOrder.map(id => map.get(id)).filter(Boolean);
                                saveState();
                                renderBoardImmediate();
                            } catch(e){ console.error(e); }
                        }
                    });
                }
            } catch(error){ console.error('Erreur Sortable global:', error); }
        }
        function initSortable() { return initSortableOptimized(); }
        function attachVirtualScrollListeners() {
            document.querySelectorAll('.column-cards').forEach(container => {
                if (container._virtualScrollAttached) return;
                container._virtualScrollAttached = true;
                let ticking = false;
                container.addEventListener('scroll', () => {
                    if (ticking) return;
                    ticking = true;
                    requestAnimationFrame(() => {
                        ticking = false;
                        const nearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 300;
                        if (nearBottom) {
                            const colId = parseInt(container.dataset.columnId);
                            const all = getCardsForColumnSorted(colId);
                            const visible = _columnVisibleCount.get(colId) || MAX_CARDS_INITIAL;
                            if (all.length > visible) {
                                loadMoreCards(colId);
                            }
                        }
                    });
                }, { passive: true });
            });
        }



        // =========== CARD ACTIONS MENU (menu "..." des cartes) ============
        // Ces deux fonctions étaient appelées mais jamais définies : le bouton
        // "3 points" / hamburger ne réagissait plus au clic. On les restaure.
        function showCardMenu(event, cardId) {
            if (event) event.stopPropagation();
            closeCardMenu();

            const card = state.cards.find(c => c.id === cardId);
            if (!card) return;
            const col = state.columns.find(c => c.id === card.columnId);
            const isCompleted = isCompletedColumn(col);

            const actions = [];
            actions.push({ label: '<svg style="width:16px;height:16px;flex-shrink:0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg> Modifier', onclick: `closeCardMenu(); editCard(${cardId})` });
            actions.push({ label: '<svg style="width:16px;height:16px;flex-shrink:0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg> Dupliquer', onclick: `closeCardMenu(); duplicateCard(${cardId})` });
            if (!isCompleted) {
                actions.push({ label: '<svg style="width:16px;height:16px;flex-shrink:0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Terminer', cls: 'success', onclick: `closeCardMenu(); showCompleteTaskModal(${cardId}, event)` });
            }
            actions.push({ label: '<svg style="width:16px;height:16px;flex-shrink:0;color:var(--sys-red)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg> Supprimer', cls: 'danger', onclick: `closeCardMenu(); deleteCard(${cardId})` });

            const menu = document.createElement('div');
            menu.className = 'card-actions-menu';
            menu.id = 'card-menu'; // referenced by global click handler
            menu.setAttribute('role', 'menu');
            menu.setAttribute('aria-label', 'Actions de la tache');
            menu.innerHTML = actions.map(a =>
                `<button class="${a.cls || ''}" role="menuitem" onclick="event.stopPropagation(); ${a.onclick}">${a.label}</button>`
            ).join('');
            document.body.appendChild(menu);

            // Positionnement intelligent : on garde le menu à l'écran
            const rect = menu.getBoundingClientRect();
            let x = event.clientX || 0;
            let y = event.clientY || 0;
            const margin = 8;
            if (x + rect.width > window.innerWidth - margin) x = window.innerWidth - rect.width - margin;
            if (y + rect.height > window.innerHeight - margin) y = window.innerHeight - rect.height - margin;
            menu.style.left = Math.max(margin, x) + 'px';
            menu.style.top = Math.max(margin, y) + 'px';
        }

        function closeCardMenu() {
            const menu = document.getElementById('card-menu');
            if (menu && menu.parentNode) menu.remove();
        }

        // =========== COLUMN MANAGEMENT ============
        function showAddColumnModal() {
            const modal = createModal('Nouvelle colonne', `
                <div class="form-group">
                    <label class="form-label">Titre</label>
                    <input type="text" class="form-input" id="new-column-title" placeholder="Ex: En attente" autofocus>
                </div>
            `, [
                { text: 'Annuler', class: 'btn-secondary', onclick: 'closeModal()' },
                { text: 'Ajouter', class: 'btn-primary', onclick: 'addColumn()' }
            ]);
            document.body.appendChild(modal);
        }

        function addColumn() {
            const title = document.getElementById('new-column-title').value.trim();
            if (!title) {
                showToast('Veuillez saisir un titre');
                return;
            }
            const availColor = COLUMN_COLORS.find(c => !state.columns.map(col => col.color).filter(Boolean).includes(c)) || '#6E6E73';
            state.columns.push({ id: allocateId('column'), title: title, color: availColor });
            saveState();
            closeModal();
            renderBoard();
            showToast('Colonne ajoutée');
        }

        function startEditColumnTitle(columnId) {
            const column = state.columns.find(c => c.id === columnId);
            if (!column) return;
            const columnEl = document.querySelector(`.column[data-column-id="${columnId}"]`);
            const titleEl = columnEl.querySelector('.column-title');
            titleEl.outerHTML = `<input type="text" class="column-title-input" value="${escapeHtml(column.title)}" id="edit-column-title-${columnId}">`;
            const input = document.getElementById(`edit-column-title-${columnId}`);
            input.focus();
            input.select();
            input.addEventListener('blur', () => saveColumnTitle(columnId));
            input.addEventListener('keypress', (e) => { if (e.key === 'Enter') saveColumnTitle(columnId); });
        }

        function saveColumnTitle(columnId) {
            const input = document.getElementById(`edit-column-title-${columnId}`);
            if (!input) return;
            const newTitle = input.value.trim();
            const column = state.columns.find(c => c.id === columnId);
            if (newTitle && column) {
                column.title = newTitle;
                saveState();
            }
            renderBoard();
        }

        function deleteColumn(columnId) {
            if (state.columns.length <= 1) {
                showToast('Action impossible : Vous devez garder au moins une colonne.');
                return;
            }
            if (!confirm('Supprimer cette colonne ? Les cartes seront déplacées vers la première colonne.')) return;
            const cardsInColumn = state.cards.filter(c => c.columnId === columnId);
            const firstColumnId = state.columns[0]?.id;
            cardsInColumn.forEach(card => { card.columnId = firstColumnId || 1; });
            state.columns = state.columns.filter(c => c.id !== columnId);
            saveState();
            renderBoard();
            showToast('Colonne supprimée');
        }

        // =========== TASK SUMMARY ============
        function showTaskSummary(cardId) {
            const card = state.cards.find(c => c.id === cardId);
            if (!card) return;
            const col = state.columns.find(c => c.id === card.columnId);
            const isCompleted = isCompletedColumn(col);

            let body = `
                <div class="task-summary">
                    <div class="task-summary-header">
                        <div class="task-summary-title">${escapeHtml(card.title)}</div>
                        <div class="task-summary-badges">
                            <span class="badge badge-priority-${card.priority}">${priorityLabels[card.priority]}</span>
                            ${card.category ? `<span class="badge badge-category" style="background: ${card.categoryColor || 'var(--bg-alt)'}; color: white;">${escapeHtml(card.category)}</span>` : ''}
                        </div>
                    </div>
                    <div class="task-summary-info">
                        ${card.startDate ? `<div class="info-item"><div class="info-label">Date de début</div><div class="info-value">${icons.calendar} ${escapeHtml(card.startDate)}</div></div>` : ''}
                        ${card.duration ? `<div class="info-item"><div class="info-label">Durée estimée</div><div class="info-value">${icons.clock} ${Math.floor(card.duration / 60)}h ${card.duration % 60}min</div></div>` : ''}
                        ${card.scheduledTime ? `<div class="info-item"><div class="info-label">Horaire prévu</div><div class="info-value">${icons.timer} ${escapeHtml(card.scheduledTime)}</div></div>` : ''}
                        ${card.deadline ? `<div class="info-item"><div class="info-label">Date limite</div><div class="info-value">${icons.calendar} ${escapeHtml(card.deadline)}</div></div>` : ''}
                        ${card.totalTimeSpent > 0 ? `<div class="info-item"><div class="info-label">Temps total</div><div class="info-value">${icons.timer} ${formatTime(card.totalTimeSpent)}</div></div>` : ''}
                    </div>
            `;

            body += window.vnPhotoGallery(card.photos || []);
            if (card.description) {
                body += `
                    <div class="task-summary-section">
                        <h3>Description</h3>
                        <div class="task-desc">${escapeHtml(card.description).replace(/\n/g, '<br>')}</div>
                    </div>
                `;
            }

            if (card.checklist && card.checklist.length > 0) {
                const completed = card.checklist.filter(i => i.checked).length;
                const total = card.checklist.length;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                const allDone = completed === total;
                const requiredItems = card.checklist.filter(i => i.required !== false);
                const requiredDone = requiredItems.filter(i => i.checked).length;
                const blockMsg = requiredItems.length > 0 && requiredDone < requiredItems.length ? `<div style="margin:8px 0 10px; padding:8px 12px; background:var(--sys-orange-bg); border:1px solid rgba(255,149,0,0.25); border-radius:var(--radius); font-size:13px; color:#B85E00; font-weight:500;">⚠️ ${requiredItems.length - requiredDone} sous-tâche(s) obligatoire(s) restante(s) — finition bloquée</div>` : '';
                body += `
                    <div class="task-summary-section checklist-section">
                        <div class="checklist-section-head">
                            <h3>Sous-tâches · ${completed}/${total}${requiredItems.length>0 ? ` · ${requiredDone}/${requiredItems.length} obligatoires` : ''}</h3>
                            <div class="checklist-progress"><div class="checklist-progress-fill ${allDone ? 'is-complete' : ''}" style="--progress:${pct}%"></div></div>
                        </div>
                        ${blockMsg}
                        <div>
                            ${card.checklist.map((item, index) => {
                                const req = item.required !== false;
                                const summaryValue = escapeHtml(item.summary || '');
                                const summaryEditor = `<div class="subtask-summary-editor">
                                    <label class="subtask-summary-label" for="subtask-summary-${cardId}-${index}">Résumé de la sous-tâche <span>optionnel</span></label>
                                    <textarea class="subtask-summary-input" id="subtask-summary-${cardId}-${index}" rows="2" placeholder="Ajouter un résultat, une information ou un lien…" oninput="setTaskSubtaskSummary(${cardId}, ${index}, this.value, false)" onblur="setTaskSubtaskSummary(${cardId}, ${index}, this.value, true)">${summaryValue}</textarea>
                                </div>`;
                                const badge = req ? `<span style="font-size:10px; font-weight:700; color:${item.checked ? 'var(--sys-green)' : 'var(--sys-orange)'}; background:${item.checked ? 'var(--sys-green-bg)' : 'var(--sys-orange-bg)'}; padding:2px 6px; border-radius:100px; margin-left:6px;">obligatoire</span>` : `<span style="font-size:10px; font-weight:600; color:var(--ink-soft); background:var(--bg-alt); padding:2px 6px; border-radius:100px; margin-left:6px;">optionnelle</span>`;
                                return `
                                <div class="checklist-item-detailed ${item.checked ? 'is-checked' : ''}" style="flex-direction:column; align-items:stretch;">
                                    <div style="display:flex; align-items:center; gap:12px; width:100%;">
                                        <div class="checklist-check" role="checkbox" aria-checked="${item.checked}" tabindex="0"
                                             onclick="toggleChecklistItem(${cardId}, ${index})"
                                             onkeydown="if(event.key===' '||event.key==='Enter'){event.preventDefault();toggleChecklistItem(${cardId}, ${index})}"></div>
                                        <div class="checklist-text ${item.checked ? 'completed' : ''}" style="flex:1;">${escapeHtml(item.text)}${badge}</div>
                                    </div>
                                    ${summaryEditor}
                                </div>
                            `}).join('')}
                        </div>
                    </div>
                `;
            }

            if (card.timeHistory && card.timeHistory.length > 0) {
                body += `
                    <div class="time-tracking">
                        <h4>Suivi du temps</h4>
                        <div class="time-entries">
                            ${card.timeHistory.slice(-10).reverse().map(entry => `
                                <div class="time-entry">
                                    ${entry.type === 'play' ? '<svg style="width:12px;height:12px;vertical-align:-1px;display:inline-block" viewBox="0 0 24 24" fill="none" stroke="var(--sys-green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Démarré' : entry.type === 'pause' ? '<svg style="width:12px;height:12px;vertical-align:-1px;display:inline-block" viewBox="0 0 24 24" fill="none" stroke="var(--sys-orange)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> En pause' : '<svg style="width:12px;height:12px;vertical-align:-1px;display:inline-block" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="1"/></svg> Arrêté'}
                                    à ${new Date(entry.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    ${entry.duration ? ` · ${formatTime(entry.duration)}` : ''}
                                </div>
                            `).join('')}
                        </div>
                        ${card.totalTimeSpent ? `<div style="margin-top: var(--space-3); font-weight: 700; color: var(--blue); font-size: 15px;">Total : ${formatTime(card.totalTimeSpent)}</div>` : ''}
                    </div>
                `;
            }

            if (card.completionNote) {
                body += `
                    <div class="task-summary-section">
                        <h3>Note de complétion</h3>
                        <div class="completion-note-detail">
                            ${escapeHtml(card.completionNote).replace(/\n/g, '<br>')}
                        </div>
                    </div>
                `;
            }

            if (!isCompleted) {
                body += `
                    <div class="completion-section">
                        <h3>Marquer comme terminée</h3>
                        <textarea class="completion-note" id="completion-note" placeholder="Ajoutez une note ou un résumé avant de terminer la tâche…"></textarea>
                        <div class="completion-actions">
                            <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
                            <button class="btn btn-success" onclick="completeTask(${cardId})">Terminer la tâche</button>
                        </div>
                    </div>
                `;
            }

            const modal = createModal('Détail de la tâche', body, []);
            document.body.appendChild(modal);
        }

        function toggleChecklistItem(cardId, itemIndex) {
            const card = state.cards.find(c => c.id === cardId);
            if (!card) return;
            card.checklist[itemIndex].checked = !card.checklist[itemIndex].checked;
            saveState();
            closeModal();
            showTaskSummary(cardId);
            renderBoard();
            updateStats();
        }

        function setTaskSubtaskSummary(cardId, itemIndex, value, persist = true) {
            const card = state.cards.find(c => c.id === cardId);
            if (!card || !card.checklist || !card.checklist[itemIndex]) return;
            card.checklist[itemIndex].summary = String(value || '');
            if (persist) saveState();
        }

        function persistCompletionSubtaskSummaries(cardId) {
            const card = state.cards.find(c => c.id === cardId);
            if (!card || !card.checklist) return;
            document.querySelectorAll('.completion-subtask-summary[data-subtask-summary-index]').forEach(field => {
                const index = Number(field.dataset.subtaskSummaryIndex);
                if (Number.isInteger(index) && card.checklist[index]) {
                    card.checklist[index].summary = field.value;
                }
            });
            saveState();
        }

        function showCompleteTaskModal(cardId, event) {
            if (event) event.stopPropagation();
            const card = state.cards.find(c => c.id === cardId);
            if (!card) return;

            const completionItems = card.checklist || [];
            const completionSubtasks = completionItems.length ? `
                <div class="completion-subtasks">
                    <div class="completion-subtasks-head">
                        <span>Résumé des sous-tâches</span>
                        <span>${completionItems.length} élément${completionItems.length > 1 ? 's' : ''}</span>
                    </div>
                    ${completionItems.map((item, index) => {
                        const isRequired = item.required !== false;
                        const status = item.checked ? 'Terminée' : 'À faire';
                        const value = escapeHtml(item.summary || '');
                        return `<div class="completion-subtask-row ${item.checked ? 'is-checked' : ''}">
                            <div class="completion-subtask-title">
                                <span class="completion-subtask-state" aria-hidden="true">${item.checked ? '✓' : '○'}</span>
                                <span>${escapeHtml(item.text)}</span>
                                ${isRequired ? '<span class="completion-subtask-required">obligatoire</span>' : ''}
                                <span class="completion-subtask-status">${status}</span>
                            </div>
                            <label class="subtask-summary-label" for="completion-subtask-summary-${cardId}-${index}">Résumé</label>
                            <textarea class="subtask-summary-input completion-subtask-summary" id="completion-subtask-summary-${cardId}-${index}" data-subtask-summary-index="${index}" rows="2" placeholder="Ajouter le résumé de cette sous-tâche…">${value}</textarea>
                        </div>`;
                    }).join('')}
                </div>` : '';

            const modal = createModal('Terminer la tâche', `
                <div style="font-size: 15px; margin-bottom: var(--space-4); color: var(--ink-soft); line-height: 1.4;">
                    Tâche : <strong style="color: var(--ink);">${escapeHtml(card.title)}</strong>
                </div>
                ${completionSubtasks}
                <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label">Note de complétion (obligatoire)</label>
                    <textarea class="completion-note" id="direct-completion-note" placeholder="Ajoutez une note ou un résumé avant de terminer la tâche…" style="width: 100%; min-height: 120px; padding: var(--space-4); background: var(--bg-alt); border-radius: var(--radius); border: 1px solid var(--line); color: var(--ink);" autofocus></textarea>
                </div>
            `, [
                { text: 'Annuler', class: 'btn-secondary', onclick: 'closeModal()' },
                { text: 'Terminer la tâche', class: 'btn-success', onclick: `submitDirectCompletion(${cardId})` }
            ]);
            document.body.appendChild(modal);
            setTimeout(() => {
                const txt = document.getElementById('direct-completion-note');
                if (txt) txt.focus();
            }, 50);
        }

        function submitDirectCompletion(cardId) {
            const noteEl = document.getElementById('direct-completion-note');
            const note = noteEl ? noteEl.value.trim() : '';
            if (!note) {
                showToast('La note de complétion est obligatoire');
                return;
            }
            const card = state.cards.find(c => c.id === cardId);
            if (!card) return;
            persistCompletionSubtaskSummaries(cardId);
            const chk2 = canCompleteTask(card);
            if (!chk2.ok) {
                showToast(`Impossible de terminer : ${chk2.count} sous-tâche(s) obligatoire(s) non cochée(s)`);
                return;
            }
            if (activeTimers[cardId]) stopTimer(cardId);
            const completedColumn = findColumnByRole('completed');
            if (!completedColumn) {
                showToast('Colonne "Terminé" introuvable');
                return;
            }
            card.columnId = completedColumn.id;
            card.completionNote = note;
            card.completedAt = new Date().toISOString();

            handleRecurrenceOnCompletion(card);
            handleDependenciesOnCompletion(card);

            saveState();
            closeAllModals();
            renderBoard();
            updateStats();
            showToast('Tâche terminée');
            setTimeout(()=>{ try{ showTaskSummary(cardId); }catch(e){} }, 180);
        }

        function completeTask(cardId) {
            const noteEls = document.getElementById('completion-note');
            const note = noteEls ? noteEls.value.trim() : '';
            if (!note) {
                showToast('La note de complétion est obligatoire');
                return;
            }
            const card = state.cards.find(c => c.id === cardId);
            if (!card) return;
            const chk = canCompleteTask(card);
            if (!chk.ok) {
                showToast(`Impossible de terminer : ${chk.count} sous-tâche(s) obligatoire(s) non cochée(s)`);
                return;
            }
            if (activeTimers[cardId]) stopTimer(cardId);
            const completedColumn = findColumnByRole('completed');
            if (!completedColumn) {
                showToast('Colonne "Terminé" introuvable');
                return;
            }
            card.columnId = completedColumn.id;
            card.completionNote = note;
            card.completedAt = new Date().toISOString();

            handleRecurrenceOnCompletion(card);
            handleDependenciesOnCompletion(card);

            saveState();
            closeModal();
            renderBoard();
            updateStats();
            showToast('Tâche terminée');
            // Résumé de tâche s'active automatiquement à l'achèvement
            setTimeout(()=>{ try{ showTaskSummary(cardId); }catch(e){} }, 180);
        }

        function buildRecurrenceFromUI() {
            // Le champ caché est la source d'autorité du formulaire. Il évite
            // qu'un ancien recState (après une modale récurrente) crée une série
            // alors que l'UI affiche « Aucune ».
            const typeInput = document.getElementById('card-recurrence-type');
            const uiFreq = typeInput ? typeInput.value : recState.freq;
            const freq = ['daily', 'weekly', 'monthly'].includes(uiFreq) ? uiFreq : 'none';
            if (freq === 'none') return { type: 'none' };
            // Synchroniser l'état mémoire avant de construire la configuration.
            recState.freq = freq;
            updateRecSummary();
            const rec = {
                type: freq,
                interval: recState.interval,
                endType: recState.endType
            };
            if (recState.endType === 'after') rec.endAfter = recState.endAfter;
            if (recState.endType === 'onDate') rec.endDate = recState.endDate;
            if (freq === 'weekly') rec.daysOfWeek = [...recState.daysOfWeek];
            if (freq === 'monthly') {
                rec.dayOfMonth = recState.isLastDay ? -1 : recState.dayOfMonth;
                rec.isLastDay = recState.isLastDay;
            }
            return rec;
        }

        function getRecurrenceSummary(card) {
            const rec = card.recurrence || { type: 'none' };
            if (!rec || rec.type === 'none') return '';
            const days = ['Lu','Ma','Me','Je','Ve','Sa','Di'];
            let text = '↻ ';
            const interval = rec.interval || 1;
            if (rec.type === 'daily') {
                text += interval > 1 ? `Tous les ${interval} jours` : 'Tous les jours';
            } else if (rec.type === 'weekly') {
                text += interval > 1 ? `Toutes les ${interval} sem.` : 'Chaque semaine';
                if (rec.daysOfWeek && rec.daysOfWeek.length > 0 && rec.daysOfWeek.length < 7) {
                    text += ' ' + rec.daysOfWeek.map(d => days[d-1]).join(',');
                }
            } else if (rec.type === 'monthly') {
                text += interval > 1 ? `Tous les ${interval} mois` : 'Chaque mois';
                if (rec.isLastDay) text += ' (dernier j.)';
                else if (rec.dayOfMonth) text += ` le ${rec.dayOfMonth}`;
            }
            return text;
        }

        function getRecurrenceBadgeLabel(card) {
            const rec = card.recurrence || { type: 'none' };
            if (!rec || rec.type === 'none') return '';
            if (rec.type === 'dependent') {
                const depTask = state.cards.find(c => c.id === rec.dependencyId);
                return '↻ ' + (depTask ? `Après: ${depTask.title.substring(0,12)}` : 'Dépendante');
            }
            const days = ['Lu','Ma','Me','Je','Ve','Sa','Di'];
            let label = '↻ ';
            const intv = rec.interval || 1;
            if (rec.type === 'daily') label += intv > 1 ? `${intv}j` : 'Jour';
            else if (rec.type === 'weekly') {
                label += intv > 1 ? `${intv} sem.` : 'Sem.';
                if (rec.daysOfWeek && rec.daysOfWeek.length > 0 && rec.daysOfWeek.length < 7) {
                    label += ' ' + rec.daysOfWeek.map(d => days[d-1]).join(',');
                }
            } else if (rec.type === 'monthly') {
                label += intv > 1 ? `${intv} mois` : 'Mois';
                if (rec.isLastDay) label += ' fin';
                else if (rec.dayOfMonth) label += ` ${rec.dayOfMonth}`;
            }
            return label;
        }

        function getNextRecurrenceDate(card) {
            const rec = card.recurrence;
            if (!rec || rec.type === 'none' || rec.type === 'dependent') return null;

            let baseDate = card.startDate ? new Date(card.startDate + 'T00:00:00') : new Date();
            let nextDate = new Date(baseDate);

            if (rec.type === 'daily') {
                nextDate.setDate(nextDate.getDate() + (rec.interval || 1));
            } else if (rec.type === 'weekly') {
                const dow = rec.daysOfWeek && rec.daysOfWeek.length > 0 ? rec.daysOfWeek : [(baseDate.getDay() || 7)];
                // Find next matching day
                for (let i = 1; i <= 7; i++) {
                    nextDate.setDate(baseDate.getDate() + i);
                    let nd = nextDate.getDay(); if (nd === 0) nd = 7;
                    if (dow.includes(nd)) break;
                }
                // Advance by (interval-1) more weeks if interval > 1
                if ((rec.interval || 1) > 1) {
                    nextDate.setDate(nextDate.getDate() + ((rec.interval || 1) - 1) * 7);
                }
            } else if (rec.type === 'monthly') {
                const targetDay = rec.isLastDay ? 31 : (rec.dayOfMonth || 15);
                nextDate.setMonth(nextDate.getMonth() + (rec.interval || 1));
                nextDate.setDate(1);
                if (targetDay === 31 || rec.isLastDay) {
                    // Last day of the new month
                    nextDate.setMonth(nextDate.getMonth() + 1);
                    nextDate.setDate(0);
                } else {
                    // Clamp to valid day
                    const maxDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
                    nextDate.setDate(Math.min(targetDay, maxDay));
                }
            }
            nextDate.setHours(0,0,0,0);
            return nextDate;
        }

        function addDaysLocal(date, n) {
            const d = new Date(date); d.setDate(d.getDate() + n); return d;
        }

        /**
         * Génère la liste des dates d'occurrence d'une récurrence à partir d'une
         * date de départ (inclusive), selon la fréquence/l'intervalle/jours.
         * On s'arrête à la première limite atteinte : endAfter occurrences,
         * endDate, ou horizon de sécurité (180 jours pour "Jamais").
         */
        function generateRecurrenceDates(rec, fromDate) {
            const dates = [];
            if (!rec || rec.type === 'none' || rec.type === 'dependent') return dates;
            const start = parseLocalDate(fromDate) || new Date();
            start.setHours(0,0,0,0);
            const interval = rec.interval || 1;

            let horizon = null;
            if (rec.endType === 'onDate' && rec.endDate) {
                horizon = parseLocalDate(rec.endDate);
                if (horizon) horizon.setHours(0,0,0,0);
            } else {
                horizon = new Date(start);
                horizon.setDate(horizon.getDate() + 180); // sécurité : 6 mois
            }
            const maxOcc = (rec.endType === 'after' && rec.endAfter)
                ? Math.min(parseInt(rec.endAfter, 10) || 52, 366)
                : 366;

            const pushIf = (d) => {
                if (d < start) return false;
                if (horizon && d > horizon) return true;
                dates.push(localDateStr(d));
                return dates.length >= maxOcc;
            };

            if (rec.type === 'daily') {
                let cur = new Date(start);
                while (dates.length < maxOcc && cur <= horizon) {
                    if (pushIf(cur)) break;
                    cur = addDaysLocal(cur, interval);
                }
            } else if (rec.type === 'weekly') {
                const dow = (rec.daysOfWeek && rec.daysOfWeek.length > 0)
                    ? [...rec.daysOfWeek].sort((a,b)=>a-b)
                    : [(start.getDay() === 0 ? 7 : start.getDay())];
                let cur = new Date(start);
                let guard = 0;
                while (dates.length < maxOcc && cur <= horizon && guard++ < 400) {
                    const jsDow = cur.getDay() === 0 ? 7 : cur.getDay();
                    if (dow.includes(jsDow)) {
                        // N° de semaine écoulé depuis le début ; n'accepter que les multiples de l'intervalle
                        const weekIndex = Math.floor((cur - start) / 604800000);
                        if (weekIndex % interval === 0) { if (pushIf(new Date(cur))) break; }
                    }
                    cur = addDaysLocal(cur, 1);
                }
            } else if (rec.type === 'monthly') {
                let cur = new Date(start.getFullYear(), start.getMonth(), 1);
                let guard = 0;
                while (dates.length < maxOcc && guard++ < 60) {
                    let day;
                    if (rec.isLastDay || rec.dayOfMonth === -1) {
                        day = new Date(cur.getFullYear(), cur.getMonth()+1, 0).getDate();
                    } else {
                        const maxDay = new Date(cur.getFullYear(), cur.getMonth()+1, 0).getDate();
                        day = Math.min(rec.dayOfMonth || 15, maxDay);
                    }
                    const candidate = new Date(cur.getFullYear(), cur.getMonth(), day);
                    candidate.setHours(0,0,0,0);
                    if (pushIf(candidate)) break;
                    cur = new Date(cur.getFullYear(), cur.getMonth()+interval, 1);
                }
            }
            return dates;
        }

        /**
         * Crée en bloc toutes les occurrences d'une tâche récurrente. La première
         * reçoit les données de la carte (éditable), les suivantes sont des
         * copies datées et routées dans la bonne colonne. Retourne le tableau
         * des cartes créées.
         */
        function createRecurringOccurrences(card) {
            const rec = card.recurrence;
            if (!rec || rec.type === 'none' || rec.type === 'dependent') {
                autoRouteTask(card);
                if (!state.cards.some(existing => existing.id === card.id)) state.cards.push(card);
                return [card];
            }
            const baseDate = card.startDate || card.deadline || localDateStr();
            if (!card.startDate) card.startDate = baseDate;
            const dates = generateRecurrenceDates(rec, baseDate);
            // Même une série d'une occurrence doit insérer sa première tâche.
            // Si la période de fin est antérieure à la date de départ, on garde
            // au minimum la tâche de départ au lieu de la perdre silencieusement.
            if (!dates.length) dates.push(baseDate);

            const created = [];
            // Marquer la série : id stable + rang pour pouvoir l'éditer/supprimer
            if (!card.recurrenceSeriesId) {
                card.recurrenceSeriesId = 'rec-' + Date.now() + '-' + Math.floor(Math.random()*1000);
            }
            card.recurrenceIndex = 0;
            card.recurrenceTotal = dates.length;
            autoRouteTask(card);
            created.push(card);
            // La première occurrence est aussi une carte de la série : elle doit
            // être présente, sans doublon, au même titre que les copies futures.
            if (!state.cards.some(existing => existing.id === card.id)) {
                state.cards.push(card);
            }

            for (let i = 1; i < dates.length; i++) {
                const d = dates[i];
                const clone = {
                    ...card,
                    id: allocateId('card'),
                    startDate: d,
                    deadline: null,
                    completionNote: null,
                    completedAt: null,
                    timeHistory: [],
                    totalTimeSpent: 0,
                    createdAt: new Date().toISOString(),
                    recurrenceSeriesId: card.recurrenceSeriesId,
                    recurrenceIndex: i,
                    recurrenceTotal: dates.length,
                    checklist: (card.checklist || []).map(it => ({ ...it, checked: false }))
                };
                // Décaler la date limite si elle existait
                if (card.deadline && card.startDate) {
                    const off = Math.round((parseLocalDate(card.deadline) - parseLocalDate(card.startDate)) / 86400000);
                    if (!isNaN(off)) {
                        const dl = addDaysLocal(parseLocalDate(d), off);
                        clone.deadline = localDateStr(dl);
                    }
                }
                autoRouteTask(clone);
                created.push(clone);
                state.cards.push(clone);
            }
            return created;
        }

        function handleRecurrenceOnCompletion(card) {
            const rec = card.recurrence;
            if (!rec || rec.type === 'none' || rec.type === 'dependent') return;
            // Les occurrences sont désormais générées à l'avance : inutile d'en
            // recréer une à la complétion (cela provoquait des doublons).
            if (card.recurrenceSeriesId) return;

            // Check end condition
            if (rec.endType === 'after') {
                // Count existing completions of this recurrence series
                const completedCount = state.cards.filter(c =>
                    c.completionNote && c.title === card.title && c.category === card.category
                ).length;
                if (completedCount >= (rec.endAfter || 10)) {
                    showToast('Récurrence terminée (' + (rec.endAfter || 10) + ' occurrences atteintes)');
                    return;
                }
            }
            if (rec.endType === 'onDate' && rec.endDate) {
                const endDate = new Date(rec.endDate + 'T00:00:00');
                if (new Date() >= endDate) {
                    showToast('Récurrence terminée (date de fin atteinte)');
                    return;
                }
            }

            const newTask = {
                ...card,
                id: allocateId('card'),
                completionNote: null,
                completedAt: null,
                timeHistory: [],
                totalTimeSpent: 0,
                createdAt: new Date().toISOString()
            };

            newTask.checklist = (newTask.checklist || []).map(item => ({...item, checked: false}));

            const nextDate = getNextRecurrenceDate(card);
            if (nextDate) {
                const y = nextDate.getFullYear();
                const m = String(nextDate.getMonth() + 1).padStart(2, '0');
                const d = String(nextDate.getDate()).padStart(2, '0');
                const isoDate = `${y}-${m}-${d}`;
                newTask.startDate = isoDate;
                if (card.deadline) {
                    // Maintain relative offset between start and deadline
                    const oldStart = card.startDate ? new Date(card.startDate + 'T00:00:00') : new Date();
                    const oldDeadline = new Date(card.deadline + 'T00:00:00');
                    const offsetDays = Math.round((oldDeadline - oldStart) / 86400000);
                    const newDeadline = new Date(nextDate);
                    newDeadline.setDate(newDeadline.getDate() + offsetDays);
                    newTask.deadline = `${newDeadline.getFullYear()}-${String(newDeadline.getMonth()+1).padStart(2,'0')}-${String(newDeadline.getDate()).padStart(2,'0')}`;
                }
                if (card.scheduledTime) {
                    newTask.scheduledTime = card.scheduledTime;
                }
            }

            const todayCol = findColumnByRole('today') || state.columns[0];
            newTask.columnId = todayCol.id;

            // Force routing based on new start date for tomorrow/next-week/next-month columns
            const routed = autoRouteTask(newTask);
            if (!routed && newTask.startDate) {
                // If autoRoute didn't change the column, verify it's correct
                const expectedTarget = getTargetColumnForDate(newTask.startDate);
                if (expectedTarget && expectedTarget !== 'today' && expectedTarget !== 'later-this-week') {
                    const futureCol = findColumnByRole(expectedTarget);
                    if (futureCol && futureCol.id !== newTask.columnId) {
                        newTask.columnId = futureCol.id;
                    }
                }
            }

            state.cards.push(newTask);
            showToast('Tâche récurrente recréée ↻');
        }

        function handleDependenciesOnCompletion(card) {
            state.cards.forEach(c => {
                const rec = c.recurrence;
                if (rec && rec.type === 'dependent' && rec.dependencyId === card.id) {
                    const todayCol = findColumnByRole('today');
                    if (todayCol && c.columnId !== todayCol.id) {
                        const col = state.columns.find(col => col.id === c.columnId);
                        if (!isCompletedColumn(col)) {
                            c.columnId = todayCol.id;
                            showToast(`Tâche déclenchée : ${c.title}`);
                        }
                    }
                }
            });
        }

        // =========== TIMELINE COLLISION ============
        function getCardTimeWindow(card) {
            const date = card.startDate || card.deadline;
            if (!date || !card.scheduledTime) return null;
            const [h, m] = card.scheduledTime.split(':').map(Number);
            const startMins = h * 60 + m;
            const duration = card.duration ? parseInt(card.duration) : 60;
            return { date, start: startMins, end: startMins + duration };
        }

        function checkTimelineCollisions(cardData, excludeId = null) {
            const windowA = getCardTimeWindow(cardData);
            if (!windowA) return [];

            const conflicts = [];
            state.cards.forEach(c => {
                if (excludeId && c.id === excludeId) return;
                const col = state.columns.find(col => col.id === c.columnId);
                if (isCompletedColumn(col)) return;

                const windowB = getCardTimeWindow(c);
                if (!windowB) return;

                if (windowA.date === windowB.date) {
                    if (windowA.start < windowB.end && windowA.end > windowB.start) {
                        conflicts.push(c);
                    }
                }
            });
            return conflicts;
        }

        function formatTimeWindow(window) {
            if (!window) return '';
            const sh = Math.floor(window.start / 60).toString().padStart(2, '0');
            const sm = (window.start % 60).toString().padStart(2, '0');
            const eh = Math.floor(window.end / 60).toString().padStart(2, '0');
            const em = (window.end % 60).toString().padStart(2, '0');
            return `${sh}:${sm} - ${eh}:${em}`;
        }

        function findFreeTimeSlots(date, duration, excludeId = null) {
            if (!date) return [];
            duration = duration || 60;

            const dayTasks = state.cards.filter(c => {
                if (excludeId && c.id === excludeId) return false;
                const col = state.columns.find(col => col.id === c.columnId);
                if (isCompletedColumn(col)) return false;
                const win = getCardTimeWindow(c);
                return win && win.date === date;
            });

            let busySlots = dayTasks.map(c => {
                const win = getCardTimeWindow(c);
                return { start: win.start, end: win.end };
            });

            busySlots.sort((a, b) => a.start - b.start);
            const mergedBusy = [];
            if (busySlots.length > 0) {
                let current = busySlots[0];
                for (let i = 1; i < busySlots.length; i++) {
                    if (busySlots[i].start <= current.end) {
                        current.end = Math.max(current.end, busySlots[i].end);
                    } else {
                        mergedBusy.push(current);
                        current = busySlots[i];
                    }
                }
                mergedBusy.push(current);
            }

            const freeSlots = [];
            let searchStart = 8 * 60;
            const searchEnd = 22 * 60;

            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

            if (date === todayStr) {
                const nowMins = today.getHours() * 60 + today.getMinutes();
                const next15 = Math.ceil(nowMins / 15) * 15;
                searchStart = Math.max(searchStart, next15);
            }

            let current = searchStart;
            for (const block of mergedBusy) {
                if (block.start - current >= duration && (current + duration) <= searchEnd) {
                    freeSlots.push({ start: current, end: current + duration });
                }
                current = Math.max(current, block.end);
            }

            if (searchEnd - current >= duration) {
                freeSlots.push({ start: current, end: current + duration });
            }

            return freeSlots.slice(0, 4);
        }

        function formatTimeWindowFromMins(startMins, endMins) {
            const sh = Math.floor(startMins / 60).toString().padStart(2, '0');
            const sm = (startMins % 60).toString().padStart(2, '0');
            const eh = Math.floor(endMins / 60).toString().padStart(2, '0');
            const em = (endMins % 60).toString().padStart(2, '0');
            return { text: `${sh}:${sm} - ${eh}:${em}`, startStr: `${sh}:${sm}` };
        }


        // Aperçu visuel des disponibilités dans les alertes de chevauchement.
        // La frise reprend la visualisation du déplacement : tâches existantes en gris,
        // tâche proposée en rouge, repères horaires et créneaux libres actionnables.
        function buildConflictSuggestionsHTML(task, excludeId = null) {
            const windowA = getCardTimeWindow(task);
            if (!windowA) return '';

            const duration = Math.max(1, windowA.end - windowA.start);
            const dateStr = windowA.date;
            const slots = findFreeTimeSlots(dateStr, duration, excludeId) || [];
            const collisions = checkTimelineCollisions(task, excludeId);
            const span = MA_DAY_END - MA_DAY_START;
            const pct = mins => Math.max(0, Math.min(100, ((mins - MA_DAY_START) / span) * 100));
            const visibleStart = Math.max(MA_DAY_START, Math.min(MA_DAY_END, windowA.start));
            const visibleEnd = Math.max(MA_DAY_START, Math.min(MA_DAY_END, windowA.end));
            const eventIsVisible = windowA.start < MA_DAY_END && windowA.end > MA_DAY_START;

            let ticks = '';
            for (let h = 8; h <= 22; h += 2) {
                const hourStyle = h === 8
                    ? 'left:4px;transform:none'
                    : (h === 22 ? 'left:calc(100% - 4px);transform:translateX(-100%)' : `left:${pct(h * 60)}%`);
                ticks += `<div class="ma-tick" style="left:${pct(h * 60)}%"></div><div class="ma-hour" style="${hourStyle}">${h}h</div>`;
            }

            const busy = state.cards.filter(c => {
                if (excludeId !== null && excludeId !== undefined && c.id === excludeId) return false;
                const col = state.columns.find(x => x.id === c.columnId);
                if (isCompletedColumn(col)) return false;
                const w = getCardTimeWindow(c);
                return w && w.date === dateStr && w.end > MA_DAY_START && w.start < MA_DAY_END;
            }).map(c => {
                const w = getCardTimeWindow(c);
                const start = Math.max(MA_DAY_START, w.start);
                const end = Math.min(MA_DAY_END, w.end);
                const left = pct(start);
                const width = Math.max(1.6, pct(end) - left);
                const label = width >= 15 ? escapeHtml(formatTimeWindow(w)) : '';
                return `<div class="ma-busy" style="left:${left}%;width:${width}%" title="${escapeHtml(c.title)} · ${escapeHtml(formatTimeWindow(w))}">${label}</div>`;
            }).join('');

            let nowLine = '';
            if (dateStr === localDateStr(new Date())) {
                const n = new Date();
                nowLine = `<div class="ma-now" style="left:${pct(n.getHours() * 60 + n.getMinutes())}%"></div>`;
            }

            let event = '';
            {
                const left = pct(visibleStart);
                const width = Math.max(3.2, (duration / span) * 100);
                const startLabel = task.scheduledTime || formatTimeWindowFromMins(windowA.start, windowA.end).startStr;
                event = `<div id="conflict-task-clip" class="ma-chip-ev ko" role="slider" tabindex="0" aria-label="Déplacer la tâche proposée sur la frise" aria-valuemin="${MA_DAY_START}" aria-valuemax="${Math.max(MA_DAY_START, MA_DAY_END - duration)}" aria-valuenow="${windowA.start}" aria-valuetext="${escapeHtml(startLabel)}" data-mins="${windowA.start}" style="left:${left}%;width:${width}%;transform:none" title="Glissez pour déplacer · Flèches : 1 min · Maj + flèches : 15 min"><span class="ma-cursor-line" aria-hidden="true"></span><div class="ma-bubble ko" id="conflict-time-bubble">${escapeHtml(startLabel)}</div><i aria-hidden="true"></i></div>`;
            }

            const dateLabel = typeof prettyMoveDate === 'function' ? prettyMoveDate(dateStr, 'short') : dateStr;
            const iconKo = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
            const iconOk = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
            let statusHTML = '';
            if (!eventIsVisible) {
                statusHTML = `<div class="ma-status warn" id="conflict-status"><span aria-hidden="true">ⓘ</span> Horaire hors de la frise (08:00–22:00)</div>`;
            } else if (collisions.length) {
                const firstTitle = String(collisions[0].title || 'Tâche existante');
                const shortTitle = firstTitle.length > 27 ? firstTitle.slice(0, 26) + '…' : firstTitle;
                statusHTML = `<div class="ma-status ko" id="conflict-status" title="${escapeHtml(collisions.map(c => c.title || 'Tâche').join(', '))}">${iconKo} Chevauche « ${escapeHtml(shortTitle)} »${collisions.length > 1 ? ' +' + (collisions.length - 1) : ''}</div>`;
            } else {
                statusHTML = `<div class="ma-status ok" id="conflict-status">${iconOk} ${escapeHtml(formatTimeWindow(windowA).replace(' - ', '–'))}</div>`;
            }

            let slotsHTML = '';
            if (slots.length) {
                slotsHTML = `<div class="ma-slots">${slots.map(slot => {
                    const formatted = formatTimeWindowFromMins(slot.start, slot.end);
                    return `<button type="button" class="ma-slot" data-start="${formatted.startStr}" onclick="applyTimeSuggestion('${formatted.startStr}')" title="Appliquer le créneau ${formatted.text}">${escapeHtml(formatted.text.replace(' - ', '–'))}</button>`;
                }).join('')}</div>`;
            } else {
                slotsHTML = `<p class="ma-no-slots"><span aria-hidden="true">⚠</span> Aucun créneau libre suffisant trouvé (08:00–22:00).</p>`;
            }

            return `
                <style>
                    .conflict-suggestions { margin-top:var(--space-4); padding-top:var(--space-3); border-top:1px solid var(--line); }
                    .conflict-suggestions .ma-heading { display:flex; align-items:center; gap:6px; font-size:14px; font-weight:600; color:#248A3D; margin:0 0 4px; }
                    .conflict-suggestions .ma-heading svg { flex:none; }
                    .conflict-suggestions .ma-date { font-size:12px; color:var(--ink-soft); margin:0 0 10px; }
                    .conflict-suggestions .ma-tl { position:relative; height:96px; border-radius:14px; background:linear-gradient(180deg,rgba(0,0,0,.02),rgba(0,0,0,0) 30%),var(--bg-alt); border:1px solid var(--line); box-shadow:inset 0 1px 2px rgba(0,0,0,.04); overflow:hidden; cursor:crosshair; user-select:none; -webkit-user-select:none; touch-action:none; }
                    .conflict-suggestions .ma-tick { position:absolute; top:32px; bottom:22px; width:1px; background:var(--line); pointer-events:none; }
                    .conflict-suggestions .ma-hour { position:absolute; bottom:5px; transform:translateX(-50%); font-size:9.5px; color:var(--ink-soft); font-variant-numeric:tabular-nums; white-space:nowrap; pointer-events:none; }
                    .conflict-suggestions .ma-busy { position:absolute; top:32px; height:34px; border-radius:9px; background:rgba(142,142,147,.20); border:1px solid rgba(142,142,147,.32); display:flex; align-items:center; justify-content:center; font-size:9.5px; font-weight:600; color:var(--ink-soft); overflow:hidden; white-space:nowrap; padding:0 6px; pointer-events:none; }
                    .conflict-suggestions .ma-now { position:absolute; top:30px; bottom:22px; width:2px; background:var(--sys-red); opacity:.5; border-radius:1px; pointer-events:none; }
                    .conflict-suggestions .ma-bubble { position:absolute; bottom:calc(100% + 7px); left:50%; transform:translateX(-50%); height:20px; padding:0 8px; border-radius:7px; background:var(--blue); color:#fff; font-size:11px; font-weight:700; font-variant-numeric:tabular-nums; display:flex; align-items:center; box-shadow:0 2px 8px rgba(0,113,227,.30); white-space:nowrap; cursor:grab; z-index:3; transition:background .15s,box-shadow .15s; }
                    .conflict-suggestions .ma-bubble.ko { background:var(--sys-red); box-shadow:0 2px 8px rgba(255,59,48,.30); }
                    .conflict-suggestions .ma-chip-ev { position:absolute; top:32px; left:0; height:34px; border-radius:10px; background:linear-gradient(180deg,#0A84FF,#0071E3); box-shadow:0 3px 12px rgba(0,113,227,.35),inset 0 1px 0 rgba(255,255,255,.25); display:flex; align-items:center; justify-content:center; z-index:2; cursor:grab; will-change:transform; touch-action:none; transition:background .15s,box-shadow .15s,filter .15s; }
                    .conflict-suggestions .ma-chip-ev.ko { background:linear-gradient(180deg,#FF6961,#FF3B30); box-shadow:0 3px 12px rgba(255,59,48,.40),inset 0 1px 0 rgba(255,255,255,.25); }
                    .conflict-suggestions .ma-chip-ev.dragging { cursor:grabbing; filter:brightness(1.05); z-index:4; transition:background .15s,box-shadow .15s !important; box-shadow:0 9px 22px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.3); }
                    .conflict-suggestions .ma-chip-ev.dragging .ma-bubble { cursor:grabbing; }
                    .conflict-suggestions .ma-chip-ev.settle { transition:transform .18s cubic-bezier(.22,1,.36,1),background .15s,box-shadow .15s; }
                    .conflict-suggestions .ma-chip-ev:focus-visible { outline:3px solid rgba(0,113,227,.35); outline-offset:3px; }
                    .conflict-suggestions .ma-cursor-line { position:absolute; left:0; top:-31px; width:2px; height:31px; border-radius:2px; background:var(--blue); opacity:.72; pointer-events:none; }
                    .conflict-suggestions .ma-chip-ev.ko .ma-cursor-line { background:var(--sys-red); }
                    .conflict-suggestions .ma-chip-ev i { display:block; width:14px; height:3px; border-radius:2px; background:rgba(255,255,255,.9); box-shadow:0 6px 0 rgba(255,255,255,.9),0 -6px 0 rgba(255,255,255,.9); pointer-events:none; }
                    .conflict-suggestions .ma-drag-hint { margin:6px 0 0; font-size:11px; color:var(--ink-soft); line-height:1.35; }
                    .conflict-suggestions .ma-status { display:flex; align-items:center; gap:7px; margin-top:8px; font-size:12.5px; font-weight:600; line-height:1.35; }
                    .conflict-suggestions .ma-status svg { flex:none; }
                    .conflict-suggestions .ma-status.ok { color:#248A3D; }
                    .conflict-suggestions .ma-status.ko { color:var(--sys-red); }
                    .conflict-suggestions .ma-status.warn { color:#B85E00; }
                    .conflict-suggestions .ma-slots { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
                    .conflict-suggestions .ma-slot { font-size:11.5px; font-weight:600; font-variant-numeric:tabular-nums; padding:5px 10px; border-radius:999px; border:1px solid rgba(52,199,89,.40); background:var(--sys-green-bg); color:#248A3D; cursor:pointer; transition:transform .15s cubic-bezier(.32,.72,0,1),background .15s,color .15s,border-color .15s; }
                    .conflict-suggestions .ma-slot:hover { border-color:#248A3D; transform:translateY(-1px); }
                    .conflict-suggestions .ma-slot:active { transform:scale(.96); }
                    .conflict-suggestions .ma-slot.on { background:var(--blue); border-color:var(--blue); color:#fff; }
                    .conflict-suggestions .ma-no-slots { display:flex; align-items:flex-start; gap:6px; margin:9px 0 0; color:#B85E00; font-size:12px; line-height:1.4; }
                    @media (max-width:420px) {
                        .conflict-suggestions .ma-tl { height:88px; }
                        .conflict-suggestions .ma-tick { top:30px; }
                        .conflict-suggestions .ma-busy,.conflict-suggestions .ma-chip-ev { top:30px; height:31px; }
                        .conflict-suggestions .ma-now { top:28px; }
                        .conflict-suggestions .ma-hour { font-size:8.5px; }
                    }
                    @media (prefers-reduced-motion:reduce) { .conflict-suggestions .ma-slot,.conflict-suggestions .ma-chip-ev { transition:none !important; } }
                </style>
                <section class="conflict-suggestions" aria-label="Créneaux libres suggérés">
                    <p class="ma-heading"><svg style="width:15px;height:15px;vertical-align:-2px;display:inline-block" viewBox="0 0 24 24" fill="none" stroke="#248A3D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg> Créneaux libres suggérés (${duration} min)</p>
                    <p class="ma-date">${escapeHtml(dateLabel)} · tâche en rouge, tâches occupées en gris</p>
                    <div class="ma-tl" id="conflict-time-track" aria-label="Frise horaire de 08:00 à 22:00">${ticks}${busy}${nowLine}${event}</div>
                    <p class="ma-drag-hint">Glissez la bulle ou la barre, ou cliquez sur la frise · ←/→ : 1 min (Maj : 15 min).</p>
                    ${statusHTML}
                    ${slotsHTML}
                </section>
            `;
        }

        // Frise interactive du conflit : le jeton suit le pointeur en requestAnimationFrame,
        // l'heure choisie est synchronisée avec le formulaire et les collisions sont recalculées.
        function wireConflictTimeline(modal, initialTask, excludeId, actionMode) {
            const section = modal.querySelector('.conflict-suggestions');
            const track = section && section.querySelector('#conflict-time-track');
            const chip = section && section.querySelector('#conflict-task-clip');
            const bubble = section && section.querySelector('#conflict-time-bubble');
            const status = section && section.querySelector('#conflict-status');
            const timeInput = document.getElementById('card-scheduled-time');
            if (!section || !track || !chip || !bubble || !status || !timeInput) return;

            const titleInput = document.getElementById('card-title');
            const dateInput = document.getElementById('card-start-date');
            const deadlineInput = document.getElementById('card-deadline');
            const durationInput = document.getElementById('card-duration');
            const message = modal.querySelector('#conflict-current-message');
            const list = modal.querySelector('#conflict-current-items');
            const question = modal.querySelector('#conflict-current-question');
            const legend = section.querySelector('.ma-date');
            const footer = modal.querySelector('.modal-footer');
            const primaryButton = footer ? footer.querySelector('.btn:last-child') : null;
            const iconKo = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 1 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
            const iconOk = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
            let lastRenderedTime = '';
            let dragging = false;
            let dragRect = null;
            let grabOffset = 0;
            let rawMins = 0;
            let rafId = 0;
            let activePointerId = null;

            const getDuration = () => {
                const parsed = durationInput ? parseInt(durationInput.value, 10) : NaN;
                return Number.isFinite(parsed) && parsed > 0 ? parsed : (initialTask.duration || 60);
            };
            const movedClamp = mins => {
                const maxStart = Math.max(MA_DAY_START, MA_DAY_END - getDuration());
                return Math.max(MA_DAY_START, Math.min(maxStart, Math.round(mins)));
            };
            const currentTask = time => ({
                ...initialTask,
                title: titleInput && titleInput.value.trim() ? titleInput.value.trim() : initialTask.title,
                startDate: dateInput ? (dateInput.value || null) : initialTask.startDate,
                deadline: deadlineInput ? (deadlineInput.value || null) : initialTask.deadline,
                scheduledTime: time,
                duration: getDuration()
            });

            function updateSummary(snapshot, collisions) {
                if (!message || !list || !question) return;
                if (collisions.length) {
                    message.textContent = `À l'heure sélectionnée, la tâche chevauche ${collisions.length === 1 ? 'la tâche suivante :' : 'les tâches suivantes :'}`;
                    list.style.display = '';
                    list.innerHTML = collisions.map(c => {
                        const w = getCardTimeWindow(c);
                        return `<li style="margin-bottom:var(--space-1);overflow-wrap:anywhere"><strong>${escapeHtml(c.title || 'Tâche')}</strong> <span style="opacity:.8">(${escapeHtml(formatTimeWindow(w))})</span></li>`;
                    }).join('');
                    question.textContent = 'Voulez-vous tout de même l’enregistrer ?';
                } else {
                    message.textContent = 'Ce créneau est libre : aucun chevauchement détecté.';
                    list.innerHTML = '';
                    list.style.display = 'none';
                    question.textContent = actionMode === 'edit'
                        ? 'Vous pouvez enregistrer la modification sur ce créneau.'
                        : 'Vous pouvez créer la tâche sur ce créneau.';
                }
                if (primaryButton) {
                    if (collisions.length) {
                        primaryButton.textContent = actionMode === 'edit' ? 'Forcer la modification' : 'Forcer la création';
                        primaryButton.classList.remove('btn-primary');
                        primaryButton.classList.add('btn-danger');
                    } else {
                        primaryButton.textContent = actionMode === 'edit' ? 'Enregistrer la modification' : 'Créer la tâche';
                        primaryButton.classList.remove('btn-danger');
                        primaryButton.classList.add('btn-primary');
                    }
                }
            }

            function updateLiveState(mins, moveChip) {
                const safeMins = Math.round(mins);
                const timeStr = minsToHHMM(safeMins);
                if (timeInput.value !== timeStr) timeInput.value = timeStr;
                if (moveChip) {
                    chip.style.left = '0px';
                    chip.style.transform = `translate3d(${maX(track, safeMins)}px,0,0)`;
                }
                if (timeStr === lastRenderedTime) return;
                lastRenderedTime = timeStr;

                const snapshot = currentTask(timeStr);
                const windowA = getCardTimeWindow(snapshot);
                const collisions = checkTimelineCollisions(snapshot, excludeId);
                const displayTime = timeStr;
                bubble.textContent = displayTime;
                chip.dataset.mins = String(safeMins);
                chip.setAttribute('aria-valuenow', String(safeMins));
                chip.setAttribute('aria-valuetext', displayTime);
                chip.title = `${snapshot.title || 'Tâche'} · ${windowA ? formatTimeWindow(windowA) : displayTime}`;
                chip.classList.toggle('ko', collisions.length > 0);
                bubble.classList.toggle('ko', collisions.length > 0);

                const outsideRange = !windowA || windowA.start < MA_DAY_START || windowA.end > MA_DAY_END;
                if (collisions.length) {
                    const firstTitle = String(collisions[0].title || 'Tâche existante');
                    const shortTitle = firstTitle.length > 27 ? firstTitle.slice(0, 26) + '…' : firstTitle;
                    status.className = 'ma-status ko';
                    status.title = collisions.map(c => c.title || 'Tâche').join(', ');
                    status.innerHTML = `${iconKo} Chevauche « ${escapeHtml(shortTitle)} »${collisions.length > 1 ? ' +' + (collisions.length - 1) : ''}`;
                } else if (outsideRange) {
                    status.className = 'ma-status warn';
                    status.title = '';
                    status.innerHTML = '<span aria-hidden="true">ⓘ</span> Tâche hors de la frise (08:00–22:00)';
                } else {
                    status.className = 'ma-status ok';
                    status.title = '';
                    status.innerHTML = `${iconOk} ${escapeHtml(formatTimeWindow(windowA).replace(' - ', '–'))}`;
                }
                if (legend) {
                    const date = snapshot.startDate || snapshot.deadline || '';
                    const dateLabel = date && typeof prettyMoveDate === 'function' ? prettyMoveDate(date, 'short') : date;
                    legend.textContent = `${dateLabel} · tâche proposée ${collisions.length ? 'en rouge' : 'en bleu'} · tâches occupées en gris`;
                }
                section.querySelectorAll('.ma-slot').forEach(slot => {
                    slot.classList.toggle('on', slot.dataset.start === timeStr);
                });
                updateSummary(snapshot, collisions);
            }

            const startTime = timeInput.value || initialTask.scheduledTime || minsToHHMM(MA_DAY_START);
            const initialMins = timeToMins(startTime);
            chip.style.left = '0px';
            chip.classList.remove('settle', 'dragging');
            chip.style.transform = `translate3d(${maX(track, initialMins)}px,0,0)`;
            updateLiveState(initialMins, false);

            const minutesFromClientX = clientX => {
                const rect = dragRect || track.getBoundingClientRect();
                return MA_DAY_START + ((clientX - rect.left) / Math.max(1, rect.width)) * (MA_DAY_END - MA_DAY_START);
            };
            const drawFrame = () => {
                rafId = 0;
                if (!dragging) return;
                const clamped = movedClamp(rawMins - grabOffset);
                updateLiveState(clamped, true);
            };
            const queueFrame = () => { if (!rafId) rafId = requestAnimationFrame(drawFrame); };
            const onDown = e => {
                if (e.button !== undefined && e.button !== 0) return;
                dragRect = track.getBoundingClientRect();
                const pointerMins = minutesFromClientX(e.clientX);
                const current = Number.isFinite(Number(chip.dataset.mins)) ? Number(chip.dataset.mins) : timeToMins(timeInput.value || startTime);
                const chipRect = chip.getBoundingClientRect();
                const bubbleRect = bubble.getBoundingClientRect();
                const hitLeft = Math.min(chipRect.left, bubbleRect.left) - 4;
                const hitRight = Math.max(chipRect.right, bubbleRect.right) + 4;
                const onTask = chip.contains(e.target) || (e.clientX >= hitLeft && e.clientX <= hitRight);
                const duration = getDuration();
                dragging = true;
                activePointerId = e.pointerId;
                rawMins = pointerMins;
                chip.classList.remove('settle');
                chip.classList.add('dragging');
                if (onTask) {
                    grabOffset = pointerMins - current;
                } else {
                    const target = movedClamp(pointerMins - duration / 2);
                    grabOffset = pointerMins - target;
                    updateLiveState(target, true);
                }
                try { track.setPointerCapture(e.pointerId); } catch (err) {}
                e.preventDefault();
            };
            const onMove = e => {
                if (!dragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
                rawMins = minutesFromClientX(e.clientX);
                queueFrame();
                e.preventDefault();
            };
            const finishDrag = e => {
                if (!dragging || (e && e.pointerId !== undefined && activePointerId !== null && e.pointerId !== activePointerId)) return;
                if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
                if (e && Number.isFinite(e.clientX)) rawMins = minutesFromClientX(e.clientX);
                const finalMins = movedClamp(rawMins - grabOffset);
                dragging = false;
                const pointerId = activePointerId;
                activePointerId = null;
                chip.classList.remove('dragging');
                updateLiveState(finalMins, true);
                if (pointerId !== null) {
                    try { if (track.hasPointerCapture(pointerId)) track.releasePointerCapture(pointerId); } catch (err) {}
                }
            };

            track.addEventListener('pointerdown', onDown);
            track.addEventListener('pointermove', onMove);
            track.addEventListener('pointerup', finishDrag);
            track.addEventListener('pointercancel', finishDrag);
            track.addEventListener('lostpointercapture', finishDrag);
            chip.addEventListener('keydown', e => {
                const current = timeToMins(timeInput.value || startTime);
                const step = e.shiftKey ? 15 : 1;
                let next = current;
                if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next -= step;
                else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next += step;
                else if (e.key === 'Home') next = MA_DAY_START;
                else if (e.key === 'End') next = MA_DAY_END - getDuration();
                else return;
                e.preventDefault();
                e.stopPropagation();
                chip.classList.add('settle');
                updateLiveState(movedClamp(next), true);
                setTimeout(() => chip.classList.remove('settle'), 220);
            });
            if (typeof ResizeObserver !== 'undefined') {
                const resizeObserver = new ResizeObserver(() => {
                    if (!modal.isConnected) { resizeObserver.disconnect(); return; }
                    const current = timeToMins(timeInput.value || startTime);
                    chip.style.transform = `translate3d(${maX(track, current)}px,0,0)`;
                });
                resizeObserver.observe(track);
            }
        }

        window.applyTimeSuggestion = function(timeStr) {
            const timeInput = document.getElementById('card-scheduled-time');
            if(timeInput) timeInput.value = timeStr;
            closeModal();
            showToast("Heure suggérée appliquée.");
        };

        // =========== CARD MANAGEMENT ============
        function showAddCardModal(columnId, mode) {
            // Modes : 'quick' (défaut), 'scheduled', 'recurring'
            mode = mode || 'quick';
            const todayStr = localDateStr();
            const now = new Date();
            const nowTime = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
            const defaultDate = todayStr;
            // Préremplit l'horaire à l'heure locale actuelle pour tous les nouveaux modes,
            // afin qu'une tâche ne soit pas créée par oubli sans heure planifiée.
            const defaultTime = nowTime;
            const isRecurring = mode === 'recurring';
            // Chaque création part d'un état propre. Cela empêche une ancienne
            // série de contaminer une tâche rapide ou planifiée suivante.
            resetRecurrenceState(isRecurring ? 'daily' : 'none');

            const titles = {
                quick: 'Nouvelle tâche rapide',
                scheduled: 'Planifier une tâche',
                recurring: 'Tâche récurrente'
            };
            const submitLabels = {
                quick: 'Créer',
                scheduled: 'Planifier',
                recurring: 'Créer la série'
            };
            const modal = createModal(titles[mode] || 'Nouvelle tâche', `
                <div class="form-section-header" style="margin-top:0;">Informations</div>
                <div class="form-group">
                    <label class="form-label-v2">Titre</label>
                    <input type="text" class="form-input" id="card-title" placeholder="Titre de la tâche" autofocus oninput="validateTitle()">
                    <div class="field-hint" id="title-hint"></div>
                </div>
                <div class="form-group">
                    <label class="form-label-v2">Description <span class="hint">optionnelle</span></label>
                    <textarea class="form-textarea" id="card-description" placeholder="Notes, détails, liens utiles…" rows="3"></textarea>${window.vnPhotoEditor([])}
                </div>

                <div class="form-section-header">Planification</div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label-v2">Date</label>
                        <input type="date" class="form-input" id="card-start-date" value="${defaultDate}">
                    </div>
                    <div class="form-group">
                        <label class="form-label-v2">Horaire</label>
                        <input type="time" class="form-input" id="card-scheduled-time" value="${defaultTime}">
                    </div>
                </div>
                <div class="deadline-toggle-row">
                    <input type="checkbox" id="card-has-deadline" onchange="toggleDeadlineField()" style="width:18px;height:18px;accent-color:var(--blue);cursor:pointer;">
                    <label class="toggle-label" for="card-has-deadline">Définir une date limite distincte</label>
                </div>
                <div id="deadline-field-container" style="display:none; margin-top:var(--space-3);">
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label-v2">Date limite</label>
                        <input type="date" class="form-input" id="card-deadline">
                    </div>
                </div>

                <div class="form-section-header">Priorité</div>
                <div class="segmented-control" id="create-priority-seg">
                    <button class="seg-option" data-priority="low" onclick="setCardPriority('low','create')">
                        <span class="seg-priority-dot low"></span> Basse
                    </button>
                    <button class="seg-option active" data-priority="medium" onclick="setCardPriority('medium','create')">
                        <span class="seg-priority-dot medium"></span> Moyenne
                    </button>
                    <button class="seg-option" data-priority="high" onclick="setCardPriority('high','create')">
                        <span class="seg-priority-dot high"></span> Haute
                    </button>
                </div>
                <input type="hidden" id="card-priority" value="medium">

                <button class="advanced-toggle" id="advanced-toggle-btn" onclick="toggleAdvancedSection()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    Plus d'options
                </button>

                <div class="advanced-section" id="advanced-section">
                    <div class="form-section-header" style="margin-top:0;">Catégorie</div>
                    <div class="category-pills" id="category-pills">
                    </div>
                    <input type="hidden" id="card-category" value="">
                    <input type="hidden" id="card-category-color" value="">

                    <div class="form-section-header">Durée estimée</div>
                    <div class="duration-pills" id="duration-pills">
                        <button class="duration-pill" data-mins="15" onclick="setCardDuration(15)">15 min</button>
                        <button class="duration-pill" data-mins="30" onclick="setCardDuration(30)">30 min</button>
                        <button class="duration-pill active" data-mins="60" onclick="setCardDuration(60)">1 h</button>
                        <button class="duration-pill" data-mins="120" onclick="setCardDuration(120)">2 h</button>
                        <button class="duration-pill" data-mins="240" onclick="setCardDuration(240)">4 h</button>
                    </div>
                    <div class="duration-stepper">
                        <button class="stepper-btn" onclick="stepDuration(-15)">−</button>
                        <span class="stepper-value" id="duration-stepper-value">1 h 00</span>
                        <button class="stepper-btn" onclick="stepDuration(15)">+</button>
                    </div>
                    <input type="hidden" id="card-duration" value="60">

                    <div class="form-section-header">Récurrence${isRecurring ? ' <span style="text-transform:none;letter-spacing:0;color:var(--blue);font-weight:600;font-size:11px;">· obligatoire</span>' : ''}</div>
                    <div class="segmented-control rec-freq-picker" id="rec-freq-picker">
                        <button class="seg-option${isRecurring ? '' : ' active'}" data-freq="none" onclick="setRecurrenceFreq('none')">Aucune</button>
                        <button class="seg-option${isRecurring ? ' active' : ''}" data-freq="daily" onclick="setRecurrenceFreq('daily')">Jour</button>
                        <button class="seg-option" data-freq="weekly" onclick="setRecurrenceFreq('weekly')">Semaine</button>
                        <button class="seg-option" data-freq="monthly" onclick="setRecurrenceFreq('monthly')">Mois</button>
                    </div>
                    <div class="rec-panel rec-hidden" id="rec-panel">
                        <div class="rec-interval-row">
                            <span>Tous les</span>
                            <button class="stepper-btn" onclick="stepRecInterval(-1)">−</button>
                            <span class="rec-interval-value" id="rec-interval-value">1</span>
                            <button class="stepper-btn" onclick="stepRecInterval(1)">+</button>
                            <span class="rec-interval-unit" id="rec-interval-unit">jours</span>
                        </div>

                        <div id="rec-days-row" style="display:none;">
                            <div class="rec-day-chips" id="rec-day-chips">
                                <button class="rec-day-chip" data-day="1" onclick="toggleRecDay(this)">Lu</button>
                                <button class="rec-day-chip" data-day="2" onclick="toggleRecDay(this)">Ma</button>
                                <button class="rec-day-chip" data-day="3" onclick="toggleRecDay(this)">Me</button>
                                <button class="rec-day-chip" data-day="4" onclick="toggleRecDay(this)">Je</button>
                                <button class="rec-day-chip" data-day="5" onclick="toggleRecDay(this)">Ve</button>
                                <button class="rec-day-chip" data-day="6" onclick="toggleRecDay(this)">Sa</button>
                                <button class="rec-day-chip" data-day="7" onclick="toggleRecDay(this)">Di</button>
                            </div>
                        </div>

                        <div id="rec-dom-row" style="display:none;">
                            <span>Le</span>
                            <button class="stepper-btn" onclick="stepRecDom(-1)">−</button>
                            <span class="rec-interval-value" id="rec-dom-value">15</span>
                            <button class="stepper-btn" onclick="stepRecDom(1)">+</button>
                            <span>du mois</span>
                        </div>
                        <label class="rec-dom-lastday" id="rec-dom-lastday-label" style="display:none;">
                            <input type="checkbox" id="rec-dom-lastday" onchange="updateRecSummary()"> Dernier jour du mois
                        </label>

                        <div class="form-section-header" style="margin-top:var(--space-4);">Fin</div>
                        <div class="rec-end-options">
                            <label class="rec-end-option">
                                <input type="radio" name="rec-end" value="never" checked onchange="toggleRecEnd()"> Jamais
                            </label>
                            <label class="rec-end-option">
                                <input type="radio" name="rec-end" value="after" onchange="toggleRecEnd()"> Après
                                <input type="number" class="rec-end-input" id="rec-end-after" min="1" max="999" value="10" style="display:none;" oninput="updateRecSummary()"> occurrences
                            </label>
                            <label class="rec-end-option">
                                <input type="radio" name="rec-end" value="onDate" onchange="toggleRecEnd()"> Le
                                <input type="date" class="rec-end-input" id="rec-end-date" style="display:none;" onchange="updateRecSummary()">
                            </label>
                        </div>
                        <div class="rec-summary" id="rec-summary">Tous les jours</div>
                    </div>
                    <input type="hidden" id="card-recurrence-type" value="none">

                    <div class="form-section-header">Sous-tâches</div>
                    <div class="checklist-add-v2">
                        <div class="checklist-add-input-wrap">
                            <span class="checklist-add-icon">＋</span>
                            <input type="text" id="new-checklist-item" placeholder="Ajouter une sous-tâche" onkeydown="if(event.key==='Enter'){event.preventDefault();addChecklistItem();}">
                        </div>
                        <button type="button" class="checklist-add-btn" onclick="addChecklistItem()">Ajouter</button>
                    </div>
                    <div class="checklist-header-row">
                        <div class="checklist-counter" id="checklist-counter">0 sur 0</div>
                        <div class="checklist-progress"><div class="checklist-progress-fill" id="checklist-progress-fill"></div></div>
                    </div>
                    <div class="checklist-items" id="checklist-items"></div>
                </div>
            `, [
                { text: 'Annuler', class: 'btn-secondary', onclick: 'closeModal()' },
                { text: submitLabels[mode], class: 'btn-primary', onclick: `createCard(${columnId}, false, '${mode}')` }
            ]);
            modal.dataset.checklist = JSON.stringify([]);
            document.body.appendChild(modal);
            initCategoryPills(null, null);
            if (isRecurring) {
                // Synchroniser immédiatement l'interface et le champ caché avant
                // le premier clic possible sur « Créer la série ».
                const adv = document.getElementById('advanced-section');
                if (adv && !adv.classList.contains('open')) toggleAdvancedSection();
                setRecurrenceFreq('daily');
                const t = document.getElementById('card-title'); if (t) t.focus();
            }
            document.getElementById('new-checklist-item').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); addChecklistItem(); }
            });
        }

        function showAddCardModalToFirstColumn(mode) {
            const firstCol = state.columns.find(c => !isCompletedColumn(c));
            if (firstCol) showAddCardModal(firstCol.id, mode || 'quick');
            else showToast('Aucune colonne disponible');
        }

        /* --- CATEGORY PILLS SYSTEM --- */
        const PRESET_CATEGORIES = [
            { name: 'Travail',   color: '#0071E3' },
            { name: 'Personnel', color: '#AF52DE' },
            { name: 'Santé',     color: '#34C759' },
            { name: 'Courses',   color: '#FF9500' },
            { name: 'Projet',    color: '#5856D6' },
            { name: 'Admin',     color: '#8E8E93' },
            { name: 'Urgent',    color: '#FF3B30' },
            { name: 'Idée',      color: '#FFCC00' },
        ];

        function initCategoryPills(selectedName, selectedColor) {
            const container = document.getElementById('category-pills');
            if (!container) return;
            let html = PRESET_CATEGORIES.map(cat => {
                const isActive = selectedName === cat.name;
                return `<button class="category-pill${isActive ? ' active' : ''}" data-cat="${escapeHtml(cat.name)}" data-color="${cat.color}" style="--pill-color:${cat.color};" onclick="selectCategoryPill('${escapeHtml(cat.name)}','${cat.color}')">
                    <span class="category-pill-dot" style="background:${cat.color};"></span>${escapeHtml(cat.name)}
                </button>`;
            }).join('');
            html += `<button class="category-pill-new" onclick="addCustomCategory()" title="Nouvelle catégorie">+</button>`;
            container.innerHTML = html;
        }

        function selectCategoryPill(name, color) {
            document.querySelectorAll('#category-pills .category-pill').forEach(b => b.classList.remove('active'));
            const btn = document.querySelector(`#category-pills .category-pill[data-cat="${escapeHtml(name)}"]`);
            if (btn) btn.classList.add('active');
            const nameInput = document.getElementById('card-category');
            const colorInput = document.getElementById('card-category-color');
            if (nameInput) nameInput.value = name;
            if (colorInput) colorInput.value = color;
        }

        function addCustomCategory() {
            const name = prompt('Nom de la nouvelle catégorie :');
            if (!name || !name.trim()) return;
            const cleanName = name.trim();
            const existing = PRESET_CATEGORIES.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
            if (existing) {
                selectCategoryPill(existing.name, existing.color);
                return;
            }
            const colors = ['#0071E3','#AF52DE','#34C759','#FF9500','#5856D6','#FF3B30','#FFCC00','#00C7BE','#FF6482','#32ADE6','#8E8E93'];
            const notUsed = colors.find(c => !PRESET_CATEGORIES.some(p => p.color === c)) || colors[PRESET_CATEGORIES.length % colors.length];
            PRESET_CATEGORIES.push({ name: cleanName, color: notUsed });
            const nameInput = document.getElementById('card-category');
            const colorInput = document.getElementById('card-category-color');
            const currentName = nameInput ? nameInput.value : null;
            const currentColor = colorInput ? colorInput.value : null;
            initCategoryPills(currentName || cleanName, currentColor || notUsed);
            selectCategoryPill(cleanName, notUsed);
        }

        /* --- PRIORITY SEGMENTED CONTROL --- */
        function setCardPriority(priority, mode) {
            const prefix = mode === 'edit' ? 'edit-' : 'create-';
            const seg = document.getElementById(prefix + 'priority-seg');
            if (seg) {
                seg.querySelectorAll('.seg-option').forEach(b => b.classList.remove('active'));
                const btn = seg.querySelector(`[data-priority="${priority}"]`);
                if (btn) btn.classList.add('active');
            }
            const hidden = document.getElementById('card-priority');
            if (hidden) hidden.value = priority;
        }

        /* --- DURATION PILLS & STEPPER --- */
        let currentDuration = 60;

        function setCardDuration(mins) {
            currentDuration = mins;
            document.querySelectorAll('#duration-pills .duration-pill').forEach(p => p.classList.remove('active'));
            const pill = document.querySelector(`#duration-pills .duration-pill[data-mins="${mins}"]`);
            if (pill) pill.classList.add('active');
            updateDurationStepperDisplay();
            const hidden = document.getElementById('card-duration');
            if (hidden) hidden.value = mins;
        }

        function stepDuration(delta) {
            currentDuration = Math.max(15, currentDuration + delta);
            document.querySelectorAll('#duration-pills .duration-pill').forEach(p => p.classList.remove('active'));
            updateDurationStepperDisplay();
            const hidden = document.getElementById('card-duration');
            if (hidden) hidden.value = currentDuration;
        }

        function updateDurationStepperDisplay() {
            const el = document.getElementById('duration-stepper-value');
            if (!el) return;
            const h = Math.floor(currentDuration / 60);
            const m = currentDuration % 60;
            if (h > 0 && m > 0) el.textContent = `${h} h ${String(m).padStart(2, '0')}`;
            else if (h > 0) el.textContent = `${h} h 00`;
            else el.textContent = `${m} min`;
        }

        /* --- DEADLINE TOGGLE --- */
        function toggleDeadlineField() {
            const cb = document.getElementById('card-has-deadline');
            const container = document.getElementById('deadline-field-container');
            if (!cb || !container) return;
            if (cb.checked) {
                container.style.display = 'block';
                container.classList.add('deadline-field-enter');
            } else {
                container.style.display = 'none';
                container.classList.remove('deadline-field-enter');
                const dl = document.getElementById('card-deadline');
                if (dl) dl.value = '';
            }
        }

        /* --- ADVANCED SECTION TOGGLE --- */
        function toggleAdvancedSection() {
            const btn = document.getElementById('advanced-toggle-btn');
            const section = document.getElementById('advanced-section');
            if (!btn || !section) return;
            const isOpen = section.classList.contains('open');
            if (isOpen) {
                section.classList.remove('open');
                btn.classList.remove('expanded');
                btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg> Plus d'options`;
            } else {
                section.classList.add('open');
                btn.classList.add('expanded');
                btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg> Moins d'options`;
            }
        }

        /* --- INLINE TITLE VALIDATION --- */
        function validateTitle() {
            const input = document.getElementById('card-title');
            const hint = document.getElementById('title-hint');
            if (!input || !hint) return;
            const len = input.value.trim().length;
            hint.classList.remove('warning');
            if (len === 0) {
                hint.textContent = '';
                input.classList.remove('input-valid');
            } else if (len < 3) {
                hint.textContent = 'Le titre doit faire au moins 3 caractères';
                hint.classList.add('warning');
                input.classList.add('input-warning');
                input.classList.remove('input-valid');
            } else {
                hint.textContent = len + ' caractères';
                input.classList.add('input-valid');
                input.classList.remove('input-warning');
            }
        }

        /* --- CHECKLIST UPDATED HELPERS --- */
        // Retrouve TOUJOURS le bon modal (celui qui contient le champ sous-tâche)
        // au lieu du "premier" .modal-overlay — crucial quand plusieurs modals
        // sont empilés (récapitulatif + édition, ou conflit d'horaire).
        function getChecklistModal() {
            const input = document.getElementById('new-checklist-item');
            return input ? input.closest('.modal-overlay') : null;
        }

        function addChecklistItem() {
            const input = document.getElementById('new-checklist-item');
            const text = input.value.trim();
            if (!text) return;
            const modal = getChecklistModal();
            if (!modal) return;
            const checklist = JSON.parse(modal.dataset.checklist || '[]');
            checklist.push({ text: text, checked: false, required: true, summary: '' });
            modal.dataset.checklist = JSON.stringify(checklist);
            renderChecklistItems();
            input.value = '';
            input.focus();
        }

        // Rendu partagé des sous-tâches (création + édition) : compteur contextuel,
        // barre de progression, case à cocher style Apple (anneau → pastille verte).
        function updateChecklistProgressUI(checklist) {
            const counter = document.getElementById('checklist-counter');
            const fill = document.getElementById('checklist-progress-fill');
            const total = checklist.length;
            const done = checklist.filter(i => i.checked).length;
            const allDone = total > 0 && done === total;
            const reqCount = checklist.filter(i => i.required !== false).length;

            if (counter) {
                let txt = total === 0 ? 'Aucune sous-tâche' : (done + ' sur ' + total);
                if (reqCount > 0) txt += ` · ${reqCount} oblig.`;
                counter.textContent = txt;
                counter.classList.toggle('is-complete', allDone);
            }
            if (fill) {
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                fill.style.setProperty('--progress', pct + '%');
                fill.classList.toggle('is-complete', allDone);
            }
        }

        function renderChecklistUI(checklist, toggleFn, removeFn) {
            const container = document.getElementById('checklist-items');
            if (!container) return;
            updateChecklistProgressUI(checklist);

            container.innerHTML = checklist.map((item, index) => {
                const req = item.required !== false;
                const sumVal = escapeHtml(item.summary || '');
                const taskState = item.checked ? 'Terminée' : 'À faire';
                return `
                <div class="checklist-item-v2 ${item.checked ? 'is-checked' : ''}" data-checklist-item-index="${index}">
                    <div class="checklist-item-main">
                        <div class="checklist-check" role="checkbox" aria-checked="${item.checked}" tabindex="0"
                             onclick="${toggleFn}(${index})" onkeydown="if(event.key===' '||event.key==='Enter'){event.preventDefault();${toggleFn}(${index})}"></div>
                        <div class="checklist-item-copy">
                            <span class="checklist-text-v2">${escapeHtml(item.text)}</span>
                            <span class="checklist-item-meta">${taskState}</span>
                        </div>
                        <label class="subtask-required-toggle ${req ? 'is-on' : 'is-off'}" data-checklist-index="${index}" title="${req ? 'Sous-tâche obligatoire' : 'Sous-tâche optionnelle'}">
                            <span class="subtask-required-caption">Obligatoire</span>
                            <input class="subtask-required-input" type="checkbox" ${req ? 'checked' : ''} onchange="toggleChecklistRequired(${index}, this.checked)" aria-label="Sous-tâche obligatoire">
                            <span class="subtask-required-switch" aria-hidden="true">
                                <span class="subtask-required-on">ON</span>
                                <span class="subtask-required-off">OFF</span>
                                <span class="subtask-required-thumb"></span>
                            </span>
                        </label>
                        <button class="checklist-del-btn" onclick="${removeFn}(${index})" title="Supprimer" aria-label="Supprimer la sous-tâche">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                    <label class="checklist-summary-row" for="checklist-summary-${index}">
                        <span class="checklist-summary-label">Résumé <span>optionnel</span></span>
                        <input class="checklist-summary-input" id="checklist-summary-${index}" type="text" placeholder="Ajouter un résumé de sous-tâche…" value="${sumVal}" oninput="updateChecklistSummary(${index}, this.value)">
                    </label>
                </div>
            `; }).join('');
        }

        function toggleChecklistRequired(index, nextRequired) {
            const modal = getChecklistModal(); if (!modal) return;
            const checklist = JSON.parse(modal.dataset.checklist || '[]');
            if (!checklist[index]) return;

            const required = typeof nextRequired === 'boolean'
                ? nextRequired
                : checklist[index].required === false;
            checklist[index].required = required;
            modal.dataset.checklist = JSON.stringify(checklist);

            // Ne pas reconstruire toute la liste : le curseur ON/OFF conserve
            // son élément et sa transition CSS peut glisser sans flash.
            const toggle = modal.querySelector(`.subtask-required-toggle[data-checklist-index="${index}"]`);
            if (toggle) {
                toggle.classList.toggle('is-on', required);
                toggle.classList.toggle('is-off', !required);
                toggle.title = required ? 'Sous-tâche obligatoire' : 'Sous-tâche optionnelle';
                const input = toggle.querySelector('.subtask-required-input');
                if (input) input.checked = required;
            }
            updateChecklistProgressUI(checklist);
        }

        function updateChecklistSummary(index, val) {
            const modal = getChecklistModal(); if (!modal) return;
            const checklist = JSON.parse(modal.dataset.checklist || '[]');
            if (!checklist[index]) return;
            checklist[index].summary = val;
            modal.dataset.checklist = JSON.stringify(checklist);
        }


        function renderChecklistItems() {
            const modal = getChecklistModal(); if (!modal) return;
            const checklist = JSON.parse(modal.dataset.checklist || '[]');
            renderChecklistUI(checklist, 'toggleNewChecklistItem', 'removeNewChecklistItem');
        }

        function toggleNewChecklistItem(index) {
            const modal = getChecklistModal(); if (!modal) return;
            const checklist = JSON.parse(modal.dataset.checklist || '[]');
            checklist[index].checked = !checklist[index].checked;
            modal.dataset.checklist = JSON.stringify(checklist);
            renderChecklistItems();
        }

        function removeNewChecklistItem(index) {
            const modal = getChecklistModal(); if (!modal) return;
            const checklist = JSON.parse(modal.dataset.checklist || '[]');
            checklist.splice(index, 1);
            modal.dataset.checklist = JSON.stringify(checklist);
            renderChecklistItems();
        }

        /* ============================================================
           RECURRENCE SYSTEM — V2 (Juillet 2026)
           ============================================================ */
        let recState = { freq: 'none', interval: 1, daysOfWeek: [], dayOfMonth: 15, isLastDay: false, endType: 'never', endAfter: 10, endDate: '' };

        function resetRecurrenceState(freq = 'none') {
            recState = {
                freq: ['daily', 'weekly', 'monthly'].includes(freq) ? freq : 'none',
                interval: 1,
                daysOfWeek: [],
                dayOfMonth: 15,
                isLastDay: false,
                endType: 'never',
                endAfter: 10,
                endDate: ''
            };
        }

        function setRecurrenceFreq(freq) {
            recState.freq = freq;
            const panel = document.getElementById('rec-panel');
            const picker = document.getElementById('rec-freq-picker');
            const typeHidden = document.getElementById('card-recurrence-type');
            const daysRow = document.getElementById('rec-days-row');
            const domRow = document.getElementById('rec-dom-row');
            const domLastdayLbl = document.getElementById('rec-dom-lastday-label');
            const intervalUnit = document.getElementById('rec-interval-unit');

            // Update segmented control
            if (picker) {
                picker.querySelectorAll('.seg-option').forEach(b => b.classList.remove('active'));
                const btn = picker.querySelector(`[data-freq="${freq}"]`);
                if (btn) btn.classList.add('active');
            }

            // Show/hide panel
            if (freq === 'none') {
                if (panel) { panel.classList.add('rec-hidden'); panel.style.display = 'none'; }
                if (typeHidden) typeHidden.value = 'none';
                return;
            }
            if (panel) { panel.classList.remove('rec-hidden'); panel.style.display = ''; }

            // Unit label
            const units = { daily: 'jours', weekly: 'semaines', monthly: 'mois' };
            if (intervalUnit) intervalUnit.textContent = units[freq] || 'jours';

            // Day-of-week chips (weekly only)
            if (daysRow) daysRow.style.display = freq === 'weekly' ? '' : 'none';
            if (domRow) domRow.style.display = freq === 'monthly' ? '' : 'none';
            if (domLastdayLbl) domLastdayLbl.style.display = freq === 'monthly' ? '' : 'none';

            if (typeHidden) typeHidden.value = freq;
            updateRecSummary();
        }

        function stepRecInterval(delta) {
            recState.interval = Math.max(1, Math.min(99, recState.interval + delta));
            const el = document.getElementById('rec-interval-value');
            if (el) el.textContent = recState.interval;
            updateRecSummary();
        }

        function toggleRecDay(chip) {
            const day = parseInt(chip.dataset.day);
            const idx = recState.daysOfWeek.indexOf(day);
            if (idx >= 0) {
                recState.daysOfWeek.splice(idx, 1);
                chip.classList.remove('active');
            } else {
                recState.daysOfWeek.push(day);
                recState.daysOfWeek.sort((a,b) => a-b);
                chip.classList.add('active');
            }
            updateRecSummary();
        }

        function stepRecDom(delta) {
            recState.dayOfMonth = Math.max(1, Math.min(31, recState.dayOfMonth + delta));
            const el = document.getElementById('rec-dom-value');
            if (el) el.textContent = recState.dayOfMonth;
            document.getElementById('rec-dom-lastday').checked = false;
            recState.isLastDay = false;
            updateRecSummary();
        }

        function toggleRecEnd() {
            const afterInput = document.getElementById('rec-end-after');
            const dateInput = document.getElementById('rec-end-date');
            const radios = document.getElementsByName('rec-end');
            let selected = 'never';
            radios.forEach(r => { if (r.checked) selected = r.value; });
            recState.endType = selected;
            if (afterInput) afterInput.style.display = selected === 'after' ? '' : 'none';
            if (dateInput) dateInput.style.display = selected === 'onDate' ? '' : 'none';
            if (selected === 'after') recState.endAfter = parseInt(afterInput?.value) || 10;
            if (selected === 'onDate') recState.endDate = dateInput?.value || '';
            updateRecSummary();
        }

        /** Initialize recurrence UI from existing card data (for edit modal) */
        function initRecurrenceFromCard(card) {
            const rec = card.recurrence || { type: 'none' };
            // Handle legacy types
            let freq = rec.type || 'none';
            if (freq === 'hourly' || freq === 'advanced' || freq === 'dependent') freq = 'none'; // legacy → none by default
            recState.freq = freq;
            recState.interval = rec.interval || 1;
            recState.daysOfWeek = rec.daysOfWeek || [];
            recState.dayOfMonth = rec.dayOfMonth || 15;
            recState.isLastDay = rec.dayOfMonth === -1;
            recState.endType = rec.endType || 'never';
            recState.endAfter = rec.endAfter || 10;
            recState.endDate = rec.endDate || '';

            // Apply to UI
            const picker = document.getElementById('rec-freq-picker');
            if (picker) {
                picker.querySelectorAll('.seg-option').forEach(b => b.classList.remove('active'));
                const btn = picker.querySelector(`[data-freq="${freq}"]`);
                if (btn) btn.classList.add('active');
            }

            const panel = document.getElementById('rec-panel');
            const typeHidden = document.getElementById('card-recurrence-type');
            if (freq === 'none') {
                if (panel) { panel.classList.add('rec-hidden'); panel.style.display = 'none'; }
                if (typeHidden) typeHidden.value = 'none';
                return;
            }
            if (panel) { panel.classList.remove('rec-hidden'); panel.style.display = ''; }
            if (typeHidden) typeHidden.value = freq;

            // Interval
            const intervalEl = document.getElementById('rec-interval-value');
            if (intervalEl) intervalEl.textContent = recState.interval;
            const unitEl = document.getElementById('rec-interval-unit');
            const units = { daily: 'jours', weekly: 'semaines', monthly: 'mois' };
            if (unitEl) unitEl.textContent = units[freq] || 'jours';

            // Days row
            const daysRow = document.getElementById('rec-days-row');
            if (daysRow) daysRow.style.display = freq === 'weekly' ? '' : 'none';
            document.querySelectorAll('#rec-day-chips .rec-day-chip').forEach(chip => {
                const d = parseInt(chip.dataset.day);
                if (recState.daysOfWeek.includes(d)) chip.classList.add('active');
                else chip.classList.remove('active');
            });

            // Day-of-month row
            const domRow = document.getElementById('rec-dom-row');
            const domLastLbl = document.getElementById('rec-dom-lastday-label');
            if (domRow) domRow.style.display = freq === 'monthly' ? '' : 'none';
            if (domLastLbl) domLastLbl.style.display = freq === 'monthly' ? '' : 'none';
            const domValue = document.getElementById('rec-dom-value');
            if (domValue) domValue.textContent = recState.isLastDay ? 31 : recState.dayOfMonth;
            const lastDayCb = document.getElementById('rec-dom-lastday');
            if (lastDayCb) lastDayCb.checked = recState.isLastDay;

            // End condition
            const afterInput = document.getElementById('rec-end-after');
            const dateInput = document.getElementById('rec-end-date');
            const radios = document.getElementsByName('rec-end');
            radios.forEach(r => { r.checked = (r.value === recState.endType); });
            if (afterInput) { afterInput.value = recState.endAfter; afterInput.style.display = recState.endType === 'after' ? '' : 'none'; }
            if (dateInput) { dateInput.value = recState.endDate; dateInput.style.display = recState.endType === 'onDate' ? '' : 'none'; }

            updateRecSummary();
        }

        /** Generate natural-language recurrence summary */
        function updateRecSummary() {
            const summaryEl = document.getElementById('rec-summary');
            if (!summaryEl) return;
            const days = ['Lu','Ma','Me','Je','Ve','Sa','Di'];

            // Read dynamic state from DOM
            const freq = recState.freq;
            const interval = parseInt(document.getElementById('rec-interval-value')?.textContent) || recState.interval;
            recState.interval = interval;

            // Days of week from chips
            const activeDays = [];
            document.querySelectorAll('#rec-day-chips .rec-day-chip.active').forEach(chip => {
                activeDays.push(parseInt(chip.dataset.day));
            });
            recState.daysOfWeek = activeDays;

            // DOM value
            const domVal = parseInt(document.getElementById('rec-dom-value')?.textContent) || recState.dayOfMonth;
            recState.dayOfMonth = domVal;

            if (freq === 'none') { summaryEl.textContent = 'Aucune répétition'; return; }

            let text = 'Tous';
            if (interval > 1) text += ` les ${interval}`;
            text += ' ' + ({ daily: 'jours', weekly: 'semaines', monthly: 'mois' }[freq] || 'jours');

            if (freq === 'weekly' && activeDays.length > 0 && activeDays.length < 7) {
                text += ' — ' + activeDays.map(d => days[d-1]).join(', ');
            }
            if (freq === 'monthly') {
                const lastCb = document.getElementById('rec-dom-lastday');
                recState.isLastDay = lastCb?.checked || false;
                if (recState.isLastDay) text += ', le dernier jour';
                else text += `, le ${domVal}`;
            }

            // End condition
            const endRadios = document.getElementsByName('rec-end');
            let endType = 'never';
            endRadios.forEach(r => { if (r.checked) endType = r.value; });
            recState.endType = endType;
            if (endType === 'after') {
                const n = parseInt(document.getElementById('rec-end-after')?.value) || 10;
                recState.endAfter = n;
                text += ` · ${n} fois`;
            } else if (endType === 'onDate') {
                const d = document.getElementById('rec-end-date')?.value;
                recState.endDate = d || '';
                if (d) text += ` · jusqu'au ${d}`;
            }

            summaryEl.textContent = text;
        }

        function createCard(columnId, force = false, mode = 'quick') {
            const title = document.getElementById('card-title').value.trim();
            if (!title) {
                showToast('Le titre est obligatoire');
                return;
            }
            const formModal = getChecklistModal() || (document.getElementById('card-title') || {}).closest?.('.modal-overlay'); if (!formModal) return;
            const checklist = JSON.parse(formModal.dataset.checklist || '[]');

            // Lire la récurrence explicitement choisie dans l'interface, quel que
            // soit le mode de création (rapide, planifié ou récurrent).
            let recurrence = buildRecurrenceFromUI();
            if (!recurrence || recurrence.type === 'none') recurrence = { type: 'none' };
            // Le mode dédié « Tâche récurrente » reste quotidien par défaut si
            // l'utilisateur n'a pas modifié la fréquence.
            if (mode === 'recurring' && recurrence.type === 'none') {
                recurrence = { type: 'daily', interval: 1, endType: 'never' };
            }

            const durInput = document.getElementById('card-duration');
            const durationVal = durInput ? parseInt(durInput.value) : null;
            const catInput = document.getElementById('card-category');
            const catColorInput = document.getElementById('card-category-color');

            const card = {
                id: 0, // identifiant définitif attribué juste avant l'insertion (allocateId)
                columnId: columnId,
                title: title,
                description: document.getElementById('card-description').value.trim(),
                photos: window.vnDraftPhotos(),
                startDate: document.getElementById('card-start-date').value || null,
                duration: durationVal && durationVal > 0 ? durationVal : null,
                scheduledTime: document.getElementById('card-scheduled-time').value || null,
                deadline: document.getElementById('card-deadline').value || null,
                priority: document.getElementById('card-priority').value,
                category: catInput ? (catInput.value.trim() || null) : null,
                categoryColor: catColorInput ? (catColorInput.value || '#0071E3') : '#0071E3',
                recurrence: recurrence,
                checklist: checklist,
                completionNote: null,
                timeHistory: [],
                totalTimeSpent: 0,
                createdAt: new Date().toISOString()
            };

            if (!force) {
                const conflicts = checkTimelineCollisions(card);
                if (conflicts.length > 0) {
                    const conflictItems = conflicts.map(c => {
                        const w = getCardTimeWindow(c);
                        return `<li style="margin-bottom: var(--space-1);"><strong>${escapeHtml(c.title)}</strong> <span style="opacity:0.8">(${formatTimeWindow(w)})</span></li>`;
                    }).join('');

                    const suggestionsHTML = buildConflictSuggestionsHTML(card, null);

                    const conflictModal = createModal('Conflit d\'horaire détecté', `
                        <p id="conflict-current-message" style="margin-bottom: var(--space-3); font-size: 15px; color: var(--ink-soft); line-height: 1.4;">
                            À l'heure sélectionnée, la tâche chevauche les tâches suivantes :
                        </p>
                        <ul id="conflict-current-items" style="margin-bottom: var(--space-4); font-size: 14px; color: var(--sys-red); background: var(--sys-red-bg); padding: var(--space-3) var(--space-3) var(--space-3) var(--space-6); border-radius: var(--radius); overflow-wrap:anywhere;">
                            ${conflictItems}
                        </ul>
                        <p id="conflict-current-question" style="font-size: 15px; color: var(--ink); font-weight: 500;">Voulez-vous tout de même l'enregistrer ?</p>
                        ${suggestionsHTML}
                    `, [
                        { text: 'Annuler', class: 'btn-secondary', onclick: 'closeModal()' },
                        { text: 'Forcer la création', class: 'btn-danger', onclick: `createCard(${columnId}, true, '${mode}')` }
                    ]);
                    document.body.appendChild(conflictModal);
                    wireConflictTimeline(conflictModal, card, null, 'create');
                    return;
                }
            }

            card.id = allocateId('card');

            // Récurrence : générer TOUTES les occurrences dès la création
            let createdCount = 1;
            if (card.recurrence && card.recurrence.type !== 'none') {
                const series = createRecurringOccurrences(card);
                createdCount = series.length;
            } else {
                autoRouteTask(card);
                state.cards.push(card);
            }

            saveState();
            closeAllModals();
            renderBoard();
            updateStats();
            showToast(createdCount > 1
                ? `Tâche récurrente créée · ${createdCount} occurrences`
                : 'Tâche créée');
            // === Notes embed hook: si la création vient d'une note, intègre automatiquement ===
            if (typeof _notesPendingEmbed !== 'undefined' && _notesPendingEmbed) {
                try {
                    const pending = _notesPendingEmbed;
                    // Trouve la/les cartes nouvellement créées (celles avec le même titre ou les plus récentes)
                    // Pour une série récurrente, on prend la première occurrence
                    let newlyCreated = null;
                    // Le card original a été créé avec `card.id = allocateId('card')` puis push(s) via createRecurringOccurrences ou state.cards.push
                    // On récupère la dernière carte avec le titre saisi (le plus fiable)
                    const titleInput = document.getElementById('card-title');
                    // En fait la variable `card` est encore en scope ici : c'est la tâche modèle
                    // Cherche la carte qui correspond au titre et qui vient d'être ajoutée
                    if (typeof card !== 'undefined' && card && card.title) {
                        // Pour une récurrence, series[0] a déjà été pushée ; on cherche par titre
                        newlyCreated = state.cards.slice().reverse().find(c => c.title === card.title && c.createdAt === card.createdAt) || state.cards[state.cards.length-1];
                        // Si série récurrente, le modèle initial n'est pas poussé; les occurrences le sont : on prend la 1ère occurrence
                        if (!newlyCreated || newlyCreated.id === 0) {
                            newlyCreated = state.cards.slice().reverse().find(c => c.title === card.title) || state.cards[state.cards.length-1];
                        }
                    } else {
                        newlyCreated = state.cards[state.cards.length-1];
                    }
                    if (newlyCreated && currentNoteId != null) {
                        const note = state.notes.find(n=>n.id===currentNoteId);
                        if (note) {
                            if (pending.blockId) {
                                // Intègre dans le bloc existant
                                const block = note.blocks.find(b=>b.id===pending.blockId);
                                if (block) {
                                    // Prépare l'embed : on doit set _taskPickerBlockId temporairement car embedTaskInCurrentBlock l'utilise
                                    const savedPicker = _taskPickerBlockId;
                                    _taskPickerBlockId = pending.blockId;
                                    embedTaskInCurrentBlock(newlyCreated.id);
                                    _taskPickerBlockId = savedPicker;
                                } else {
                                    // Bloc introuvable -> ajoute en fin
                                    const nb = createBlockData('task','', { cardId: newlyCreated.id, taskMeta: { title: newlyCreated.title } });
                                    nb.content = newlyCreated.title;
                                    note.blocks.push(nb);
                                    note.updatedAt = new Date().toISOString();
                                    saveState();
                                    renderNotesBlocks();
                                    renderNotesSidebar();
                                }
                            } else {
                                // Quick create sans bloc cible -> ajoute en fin
                                const nb = createBlockData('task','', { cardId: newlyCreated.id, taskMeta: { title: newlyCreated.title } });
                                nb.content = newlyCreated.title;
                                note.blocks.push(nb);
                                note.updatedAt = new Date().toISOString();
                                saveState();
                                renderNotesBlocks();
                                renderNotesSidebar();
                                showToast(`Tâche “${newlyCreated.title}” ajoutée à la note`);
                            }
                            // Force refresh des embeds
                            setTimeout(()=> { if (typeof refreshTaskEmbeds==='function') refreshTaskEmbeds(); }, 150);
                        }
                    }
                    // Nettoie le pending seulement si on n'est pas dans un conflit (modal encore ouvert avec conflit)
                    const stillConflict = document.body.innerHTML.includes('Conflit d\'horaire');
                    if (!stillConflict) {
                        _notesPendingEmbed = null;
                    }
                } catch(e) { console.warn('Notes auto-embed failed', e); _notesPendingEmbed = null; }
            }
        }

        function editCard(cardId) {
            closeCardMenu();
            const card = state.cards.find(c => c.id === cardId);
            if (!card) return;
            const hasDeadline = !!(card.deadline && card.deadline !== (card.startDate || ''));
            const durVal = card.duration || 60;
            const modal = createModal('Modifier la tâche', `
                <div class="form-section-header" style="margin-top:0;">Informations</div>
                <div class="form-group">
                    <label class="form-label-v2">Titre</label>
                    <input type="text" class="form-input" id="card-title" value="${escapeHtml(card.title)}" autofocus oninput="validateTitle()">
                    <div class="field-hint" id="title-hint">${card.title.length} caractères</div>
                </div>
                <div class="form-group">
                    <label class="form-label-v2">Description <span class="hint">optionnelle</span></label>
                    <textarea class="form-textarea" id="card-description" rows="3">${escapeHtml(card.description || '')}</textarea>${window.vnPhotoEditor(card.photos || [])}
                </div>

                <div class="form-section-header">Planification</div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label-v2">Date</label>
                        <input type="date" class="form-input" id="card-start-date" value="${card.startDate || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label-v2">Horaire</label>
                        <input type="time" class="form-input" id="card-scheduled-time" value="${card.scheduledTime || ''}">
                    </div>
                </div>
                <div class="deadline-toggle-row">
                    <input type="checkbox" id="card-has-deadline" onchange="toggleDeadlineField()" ${hasDeadline ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--blue);cursor:pointer;">
                    <label class="toggle-label" for="card-has-deadline">Définir une date limite distincte</label>
                </div>
                <div id="deadline-field-container" style="${hasDeadline ? '' : 'display:none;'} margin-top:var(--space-3);">
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label-v2">Date limite</label>
                        <input type="date" class="form-input" id="card-deadline" value="${card.deadline || ''}">
                    </div>
                </div>

                <div class="form-section-header">Priorité</div>
                <div class="segmented-control" id="edit-priority-seg">
                    <button class="seg-option${card.priority === 'low' ? ' active' : ''}" data-priority="low" onclick="setCardPriority('low','edit')">
                        <span class="seg-priority-dot low"></span> Basse
                    </button>
                    <button class="seg-option${card.priority === 'medium' ? ' active' : ''}" data-priority="medium" onclick="setCardPriority('medium','edit')">
                        <span class="seg-priority-dot medium"></span> Moyenne
                    </button>
                    <button class="seg-option${card.priority === 'high' ? ' active' : ''}" data-priority="high" onclick="setCardPriority('high','edit')">
                        <span class="seg-priority-dot high"></span> Haute
                    </button>
                </div>
                <input type="hidden" id="card-priority" value="${card.priority}">

                <button class="advanced-toggle expanded" id="advanced-toggle-btn" onclick="toggleAdvancedSection()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    Moins d'options
                </button>

                <div class="advanced-section open" id="advanced-section">
                    <div class="form-section-header" style="margin-top:0;">Catégorie</div>
                    <div class="category-pills" id="category-pills">
                    </div>
                    <input type="hidden" id="card-category" value="${escapeHtml(card.category || '')}">
                    <input type="hidden" id="card-category-color" value="${card.categoryColor || '#0071E3'}">

                    <div class="form-section-header">Durée estimée</div>
                    <div class="duration-pills" id="duration-pills">
                        <button class="duration-pill${durVal === 15 ? ' active' : ''}" data-mins="15" onclick="setCardDuration(15)">15 min</button>
                        <button class="duration-pill${durVal === 30 ? ' active' : ''}" data-mins="30" onclick="setCardDuration(30)">30 min</button>
                        <button class="duration-pill${durVal === 60 ? ' active' : ''}" data-mins="60" onclick="setCardDuration(60)">1 h</button>
                        <button class="duration-pill${durVal === 120 ? ' active' : ''}" data-mins="120" onclick="setCardDuration(120)">2 h</button>
                        <button class="duration-pill${durVal === 240 ? ' active' : ''}" data-mins="240" onclick="setCardDuration(240)">4 h</button>
                    </div>
                    <div class="duration-stepper">
                        <button class="stepper-btn" onclick="stepDuration(-15)">−</button>
                        <span class="stepper-value" id="duration-stepper-value"></span>
                        <button class="stepper-btn" onclick="stepDuration(15)">+</button>
                    </div>
                    <input type="hidden" id="card-duration" value="${durVal}">

                    <div class="form-section-header">Récurrence</div>
                    <div class="segmented-control rec-freq-picker" id="rec-freq-picker">
                        <button class="seg-option active" data-freq="none" onclick="setRecurrenceFreq('none')">Aucune</button>
                        <button class="seg-option" data-freq="daily" onclick="setRecurrenceFreq('daily')">Jour</button>
                        <button class="seg-option" data-freq="weekly" onclick="setRecurrenceFreq('weekly')">Semaine</button>
                        <button class="seg-option" data-freq="monthly" onclick="setRecurrenceFreq('monthly')">Mois</button>
                    </div>
                    <div class="rec-panel rec-hidden" id="rec-panel">
                        <div class="rec-interval-row">
                            <span>Tous les</span>
                            <button class="stepper-btn" onclick="stepRecInterval(-1)">−</button>
                            <span class="rec-interval-value" id="rec-interval-value">1</span>
                            <button class="stepper-btn" onclick="stepRecInterval(1)">+</button>
                            <span class="rec-interval-unit" id="rec-interval-unit">jours</span>
                        </div>

                        <div id="rec-days-row" style="display:none;">
                            <div class="rec-day-chips" id="rec-day-chips">
                                <button class="rec-day-chip" data-day="1" onclick="toggleRecDay(this)">Lu</button>
                                <button class="rec-day-chip" data-day="2" onclick="toggleRecDay(this)">Ma</button>
                                <button class="rec-day-chip" data-day="3" onclick="toggleRecDay(this)">Me</button>
                                <button class="rec-day-chip" data-day="4" onclick="toggleRecDay(this)">Je</button>
                                <button class="rec-day-chip" data-day="5" onclick="toggleRecDay(this)">Ve</button>
                                <button class="rec-day-chip" data-day="6" onclick="toggleRecDay(this)">Sa</button>
                                <button class="rec-day-chip" data-day="7" onclick="toggleRecDay(this)">Di</button>
                            </div>
                        </div>

                        <div id="rec-dom-row" style="display:none;">
                            <span>Le</span>
                            <button class="stepper-btn" onclick="stepRecDom(-1)">−</button>
                            <span class="rec-interval-value" id="rec-dom-value">15</span>
                            <button class="stepper-btn" onclick="stepRecDom(1)">+</button>
                            <span>du mois</span>
                        </div>
                        <label class="rec-dom-lastday" id="rec-dom-lastday-label" style="display:none;">
                            <input type="checkbox" id="rec-dom-lastday" onchange="updateRecSummary()"> Dernier jour du mois
                        </label>

                        <div class="form-section-header" style="margin-top:var(--space-4);">Fin</div>
                        <div class="rec-end-options">
                            <label class="rec-end-option">
                                <input type="radio" name="rec-end" value="never" checked onchange="toggleRecEnd()"> Jamais
                            </label>
                            <label class="rec-end-option">
                                <input type="radio" name="rec-end" value="after" onchange="toggleRecEnd()"> Après
                                <input type="number" class="rec-end-input" id="rec-end-after" min="1" max="999" value="10" style="display:none;" oninput="updateRecSummary()"> occurrences
                            </label>
                            <label class="rec-end-option">
                                <input type="radio" name="rec-end" value="onDate" onchange="toggleRecEnd()"> Le
                                <input type="date" class="rec-end-input" id="rec-end-date" style="display:none;" onchange="updateRecSummary()">
                            </label>
                        </div>
                        <div class="rec-summary" id="rec-summary">Tous les jours</div>
                    </div>
                    <input type="hidden" id="card-recurrence-type" value="none">
                    <input type="hidden" id="card-id-hidden" value="${card.id}">

                    <div class="form-section-header">Sous-tâches</div>
                    <div class="checklist-add-v2">
                        <div class="checklist-add-input-wrap">
                            <span class="checklist-add-icon">＋</span>
                            <input type="text" id="new-checklist-item" placeholder="Ajouter une sous-tâche" onkeydown="if(event.key==='Enter'){event.preventDefault();addEditChecklistItem();}">
                        </div>
                        <button type="button" class="checklist-add-btn" onclick="addEditChecklistItem()">Ajouter</button>
                    </div>
                    <div class="checklist-header-row">
                        <div class="checklist-counter" id="checklist-counter">${(card.checklist || []).length} sous-tâche${(card.checklist || []).length !== 1 ? 's' : ''}</div>
                        <div class="checklist-progress"><div class="checklist-progress-fill" id="checklist-progress-fill"></div></div>
                    </div>
                    <div class="checklist-items" id="checklist-items"></div>
                </div>
            `, [
                { text: 'Annuler', class: 'btn-secondary', onclick: 'closeModal()' },
                { text: 'Enregistrer', class: 'btn-primary', onclick: `updateCard(${cardId})` }
            ]);
            modal.dataset.checklist = JSON.stringify(card.checklist || []);
            document.body.appendChild(modal);
            initCategoryPills(card.category || null, card.categoryColor || null);
            currentDuration = durVal;
            updateDurationStepperDisplay();
            initRecurrenceFromCard(card);
            renderEditChecklistItems();
            document.getElementById('new-checklist-item').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); addEditChecklistItem(); }
            });
        }

        function addEditChecklistItem() {
            const input = document.getElementById('new-checklist-item');
            const text = input.value.trim();
            if (!text) return;
            const modal = getChecklistModal();
            if (!modal) return;
            const checklist = JSON.parse(modal.dataset.checklist || '[]');
            checklist.push({ text: text, checked: false, required: true, summary: '' });
            modal.dataset.checklist = JSON.stringify(checklist);
            renderEditChecklistItems();
            input.value = '';
            input.focus();
        }

        function renderEditChecklistItems() {
            const modal = getChecklistModal(); if (!modal) return;
            const checklist = JSON.parse(modal.dataset.checklist || '[]');
            renderChecklistUI(checklist, 'toggleEditChecklistItem', 'removeEditChecklistItem');
        }

        function toggleEditChecklistItem(index) {
            const modal = getChecklistModal(); if (!modal) return;
            const checklist = JSON.parse(modal.dataset.checklist || '[]');
            checklist[index].checked = !checklist[index].checked;
            modal.dataset.checklist = JSON.stringify(checklist);
            renderEditChecklistItems();
        }

        function removeEditChecklistItem(index) {
            const modal = getChecklistModal(); if (!modal) return;
            const checklist = JSON.parse(modal.dataset.checklist || '[]');
            checklist.splice(index, 1);
            modal.dataset.checklist = JSON.stringify(checklist);
            renderEditChecklistItems();
        }

        function updateCard(cardId, force = false) {
            const card = state.cards.find(c => c.id === cardId);
            if (!card) return;
            const formModal = getChecklistModal() || (document.getElementById('card-title') || {}).closest?.('.modal-overlay'); if (!formModal) return;
            const checklist = JSON.parse(formModal.dataset.checklist || '[]');

            const recType = document.getElementById('card-recurrence-type').value;
            const recurrence = buildRecurrenceFromUI();

            const durInput = document.getElementById('card-duration');
            const durationVal = durInput ? parseInt(durInput.value) : null;
            const catInput = document.getElementById('card-category');
            const catColorInput = document.getElementById('card-category-color');

            const tempCard = {
                ...card,
                title: document.getElementById('card-title').value.trim(),
                description: document.getElementById('card-description').value.trim(),
                photos: window.vnDraftPhotos(),
                startDate: document.getElementById('card-start-date').value || null,
                duration: durationVal && durationVal > 0 ? durationVal : null,
                scheduledTime: document.getElementById('card-scheduled-time').value || null,
                deadline: document.getElementById('card-deadline').value || null,
                priority: document.getElementById('card-priority').value,
                category: catInput ? (catInput.value.trim() || null) : null,
                categoryColor: catColorInput ? (catColorInput.value || '#0071E3') : '#0071E3',
                recurrence: recurrence,
                checklist: checklist
            };

            if (!force) {
                const conflicts = checkTimelineCollisions(tempCard, cardId);
                if (conflicts.length > 0) {
                    const conflictItems = conflicts.map(c => {
                        const w = getCardTimeWindow(c);
                        return `<li style="margin-bottom: var(--space-1);"><strong>${escapeHtml(c.title)}</strong> <span style="opacity:0.8">(${formatTimeWindow(w)})</span></li>`;
                    }).join('');

                    const suggestionsHTML = buildConflictSuggestionsHTML(tempCard, cardId);

                    const conflictModal = createModal('Conflit d\'horaire détecté', `
                        <p id="conflict-current-message" style="margin-bottom: var(--space-3); font-size: 15px; color: var(--ink-soft); line-height: 1.4;">
                            À l'heure sélectionnée, la tâche chevauche les tâches suivantes :
                        </p>
                        <ul id="conflict-current-items" style="margin-bottom: var(--space-4); font-size: 14px; color: var(--sys-red); background: var(--sys-red-bg); padding: var(--space-3) var(--space-3) var(--space-3) var(--space-6); border-radius: var(--radius); overflow-wrap:anywhere;">
                            ${conflictItems}
                        </ul>
                        <p id="conflict-current-question" style="font-size: 15px; color: var(--ink); font-weight: 500;">Voulez-vous tout de même l'enregistrer ?</p>
                        ${suggestionsHTML}
                    `, [
                        { text: 'Annuler', class: 'btn-secondary', onclick: 'closeModal()' },
                        { text: 'Forcer la modification', class: 'btn-danger', onclick: `updateCard(${cardId}, true)` }
                    ]);
                    document.body.appendChild(conflictModal);
                    wireConflictTimeline(conflictModal, tempCard, cardId, 'edit');
                    return;
                }
            }

            // === Récurrence : régénérer proprement la série ===
            const hadRecurrence = card.recurrence && card.recurrence.type !== 'none';
            const hasRecurrence = tempCard.recurrence && tempCard.recurrence.type !== 'none';
            const oldSeriesId = card.recurrenceSeriesId;
            const todayStr = localDateStr();

            // Toujours repartir d'un tableau propre : retirer les occurrences
            // futures non terminées de l'ancienne série (sauf la carte courante).
            if (oldSeriesId) {
                state.cards = state.cards.filter(c =>
                    !(c.recurrenceSeriesId === oldSeriesId
                      && c.id !== cardId
                      && !c.completedAt
                      && (!c.startDate || c.startDate >= todayStr))
                );
            }
            // S'assurer que la carte éditée est bien présente
            if (!state.cards.find(c => c.id === cardId)) state.cards.push(card);

            if (hasRecurrence) {
                Object.assign(card, tempCard);
                card.id = cardId;
                if (!card.recurrenceSeriesId || card.recurrenceSeriesId !== oldSeriesId) {
                    card.recurrenceSeriesId = 'rec-' + Date.now() + '-' + Math.floor(Math.random()*1000);
                }
                card.completedAt = card.completedAt || null;
                card.recurrenceIndex = 0;
                const series = createRecurringOccurrences(card);
                showToast(`Tâche mise à jour · ${series.length} occurrences`);
            } else {
                Object.assign(card, tempCard);
                // La récurrence a été retirée : purger l'identifiant de série
                delete card.recurrenceSeriesId;
                delete card.recurrenceIndex;
                delete card.recurrenceTotal;
                autoRouteTask(card);
                // Si d'autres occurrences de l'ANCIENNE série subsistent (non terminées), les supprimer
                if (hadRecurrence && oldSeriesId) {
                    state.cards = state.cards.filter(c =>
                        !(c.recurrenceSeriesId === oldSeriesId && c.id !== cardId && !c.completedAt)
                    );
                }
                showToast('Tâche mise à jour');
            }

            saveState();
            closeAllModals();
            renderBoard();
            updateStats();
        }

        function duplicateCard(cardId) {
            closeCardMenu();
            const card = state.cards.find(c => c.id === cardId);
            if (!card) return;
            const newCard = {
                ...card,
                id: allocateId('card'),
                title: card.title + ' (copie)',
                columnId: card.columnId,
                completionNote: null,
                timeHistory: [],
                totalTimeSpent: 0,
                createdAt: new Date().toISOString()
            };
            delete newCard.completedAt;
            state.cards.push(newCard);
            saveState();
            renderBoard();
            updateStats();
            showToast('Tâche dupliquée');
        }

        function deleteCard(cardId) {
            closeCardMenu();
            const card = state.cards.find(c => c.id === cardId);
            if (!card) return;

            if (card.recurrence && card.recurrence.type !== 'none' && card.recurrence.type !== 'dependent') {
                const seriesCount = countSeriesOccurrences(card);
                const countLabel = seriesCount > 1 ? (' (' + seriesCount + ')') : '';
                const modal = createModal('Supprimer la tâche', `
                    <p style="margin-bottom: var(--space-4); font-size: 15px; color: var(--ink-soft); line-height: 1.4;">
                        Cette tâche fait partie d'une <strong>série récurrente</strong>` + (seriesCount > 1 ? ' (' + seriesCount + ' occurrences)' : '') + `. Voulez-vous supprimer uniquement cette occurrence, ou supprimer <strong>toute la série</strong> ?
                    </p>
                `, [
                    { text: 'Annuler', class: 'btn-secondary', onclick: 'closeModal()' },
                    { text: 'Uniquement celle-ci', class: 'btn-warning', onclick: `executeDeleteCard(${cardId}, 'single')` },
                    { text: 'Toute la série' + countLabel, class: 'btn-danger', onclick: `executeDeleteCard(${cardId}, 'all')` }
                ]);
                document.body.appendChild(modal);
            } else {
                if (!confirm('Supprimer cette tâche ?')) return;
                executeDeleteCard(cardId, 'all');
            }
        }

        /**
         * Identifie toutes les cartes d'une même série récurrente.
         * Utilise recurrenceSeriesId (séries récentes) ou, pour les anciennes
         * tâches, un regroupement par titre + catégorie + type/intervalle.
         */
        function getSeriesCards(card) {
            if (!card || !card.recurrence || card.recurrence.type === 'none') return [card];
            if (card.recurrenceSeriesId) {
                const siblings = state.cards.filter(c => c.recurrenceSeriesId === card.recurrenceSeriesId);
                if (siblings.length > 0) return siblings;
            }
            return state.cards.filter(c =>
                c.title === card.title &&
                (c.category || null) === (card.category || null) &&
                c.recurrence &&
                c.recurrence.type === card.recurrence.type &&
                (c.recurrence.interval || 1) === (card.recurrence.interval || 1)
            );
        }

        function countSeriesOccurrences(card) {
            return getSeriesCards(card).length;
        }

        function executeDeleteCard(cardId, mode) {
            const card = state.cards.find(c => c.id === cardId);
            if (!card) return;

            if (activeTimers[cardId]) stopTimer(cardId);

            let removedCount = 1;
            if (mode === 'all' && card.recurrence && card.recurrence.type !== 'none') {
                // Supprimer TOUTES les occurrences de la série (passées et futures)
                const series = getSeriesCards(card);
                const ids = new Set(series.map(c => c.id));
                series.forEach(c => { if (activeTimers[c.id]) stopTimer(c.id); });
                state.cards = state.cards.filter(c => !ids.has(c.id));
                removedCount = ids.size;
            } else {
                if (mode === 'single') handleRecurrenceOnCompletion(card);
                state.cards = state.cards.filter(c => c.id !== cardId);
            }

            saveState();
            closeModal();
            renderBoard();
            updateStats();
            showToast(removedCount > 1
                ? ('Série supprimée · ' + removedCount + ' occurrences')
                : 'Tâche supprimée');
        }

        // =========== RESET DAY ============
        function resetDay() {
            const modal = createModal('Clôturer la journée', `
                <p style="margin-bottom: var(--space-4); font-size: 15px; color: var(--ink-soft);">Comment souhaitez-vous gérer les tâches non terminées ?</p>
                <div style="display: flex; gap: var(--space-3); flex-direction: column;">
                    <button class="btn btn-secondary" onclick="executeResetDay('keep')" style="justify-content: flex-start; padding: var(--space-4) var(--space-4);">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.7; margin-right:var(--space-3)"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                        Archiver les terminées et conserver le reste
                    </button>
                    <button class="btn btn-danger" onclick="executeResetDay('delete')" style="justify-content: flex-start; padding: var(--space-4) var(--space-4);">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.7; margin-right:var(--space-3)"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        Archiver les terminées et supprimer le reste
                    </button>
                </div>
                <p style="margin-top: var(--space-4); font-size: 13px; color: var(--ink-soft);">
                    Les tâches terminées seront déplacées dans l'historique.<br>
                    Les tâches récurrentes sont déjà gérées automatiquement lors de leur complétion.
                </p>
            `, []);
            document.body.appendChild(modal);
        }

        function executeResetDay(action) {
            stopAllTimers();
            const today = new Date().toISOString().split('T')[0];

            const completedTasks = state.cards.filter(c => {
                const col = state.columns.find(col => col.id === c.columnId);
                return isCompletedColumn(col);
            });

            if (completedTasks.length > 0) {
                archive.unshift({
                    date: today,
                    completed: completedTasks.length,
                    total: state.cards.length,
                    tasks: completedTasks.map(c => ({
                        title: c.title,
                        priority: c.priority,
                        category: c.category,
                        totalTimeSpent: c.totalTimeSpent || 0
                    }))
                });
                if (archive.length > 30) archive = archive.slice(0, 30);
                saveArchive();
            }

            if (action === 'keep') {
                state.cards = state.cards.filter(c => {
                    const col = state.columns.find(col => col.id === c.columnId);
                    return !isCompletedColumn(col);
                });
            } else if (action === 'delete') {
                state.cards = [];
            }

            saveState();
            closeModal();
            renderBoard();
            updateStats();
            showToast('Journée clôturée avec succès');
        }

        // =========== STATISTICS ============
        function updateStats() {
            syncStatColors();
            const completedCol = findColumnByRole('completed');
            const weekCol = findColumnByRole('week');
            const nextMonthCol = findColumnByRole('next-month');
            const todayCol = findColumnByRole('today');
            const yesterdayCol = findColumnByRole('yesterday');

            const completed = completedCol ? state.cards.filter(c => c.columnId === completedCol.id).length : 0;
            const week = weekCol ? state.cards.filter(c => c.columnId === weekCol.id).length : 0;
            const nextMonth = nextMonthCol ? state.cards.filter(c => c.columnId === nextMonthCol.id).length : 0;
            const today = todayCol ? state.cards.filter(c => c.columnId === todayCol.id).length : 0;
            const yesterday = yesterdayCol ? state.cards.filter(c => c.columnId === yesterdayCol.id).length : 0;

            let overdue = 0;
            state.cards.forEach(card => {
                const col = state.columns.find(c => c.id === card.columnId);
                if (!isCompletedColumn(col)) {
                    if (getDeadlineStatus(card.deadline, card.scheduledTime) === 'overdue') overdue++;
                }
            });

            animateStatNumber('stat-completed', completed);
            animateStatNumber('stat-week', week);
            animateStatNumber('stat-next-month', nextMonth);
            animateStatNumber('stat-todo', today);
            animateStatNumber('stat-yesterday', yesterday);
            animateStatNumber('stat-overdue', overdue);
        }

        // =========== EXPORT CSV ============
        function exportCSV() {
            try {
                const today = new Date().toISOString().split('T')[0];
                let csv = '\ufeff';
                csv += 'Titre,Description,Date début,Durée (min),Colonne,Priorité,Catégorie,Horaire,Date limite,Récurrent,Checklist,Note de complétion,Temps total (s)\n';
                state.cards.forEach(card => {
                    const col = state.columns.find(c => c.id === card.columnId);
                    const checklistSummary = card.checklist && card.checklist.length > 0
                        ? `${card.checklist.filter(i => i.checked).length}/${card.checklist.length} complété`
                        : '';
                    const recStr = card.recurrence && card.recurrence.type !== 'none' ? card.recurrence.type : 'Non';
                    const liveSession = activeTimers[card.id] && activeTimers[card.id].startTime ? Math.floor((Date.now() - activeTimers[card.id].startTime) / 1000) : 0;
                    const totalSecs = (card.totalTimeSpent || 0) + liveSession;
                    csv += `"${escapeCsv(card.title)}","${escapeCsv(card.description || '')}","${card.startDate || ''}","${card.duration || ''}","${col ? col.title : ''}","${card.priority}","${card.category || ''}","${card.scheduledTime || ''}","${card.deadline || ''}","${recStr}","${checklistSummary}","${escapeCsv(card.completionNote || '')}","${totalSecs}"\n`;
                });
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `taches_${today}.csv`;
                link.click();
                showToast('Export CSV téléchargé');
            } catch (error) {
                console.error('Erreur export:', error);
                showToast('Erreur lors de l\'export CSV');
            }
        }

        // =========== ARCHIVE ============
        function toggleArchive() {
            const panel = document.getElementById('archive-panel');
            panel.classList.toggle('open');
            if (panel.classList.contains('open')) renderArchive();
        }

        function toggleTheme() {
            const html = document.documentElement;
            const current = html.classList.contains('dark-mode') ? 'dark' : 'light';
            const next = current === 'dark' ? 'light' : 'dark';

            if (next === 'dark') {
                html.classList.add('dark-mode');
                html.classList.remove('light-mode');
                document.getElementById('theme-icon').innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
            } else {
                html.classList.add('light-mode');
                html.classList.remove('dark-mode');
                document.getElementById('theme-icon').innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
            }
            localStorage.setItem('vn-theme', next);
            const meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.setAttribute('content', next === 'dark' ? '#0A0A0C' : '#FBFBFD');
        }

        function initTheme() {
            const saved = localStorage.getItem('vn-theme');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const html = document.documentElement;

            if (saved === 'dark' || (!saved && prefersDark)) {
                html.classList.add('dark-mode');
                document.getElementById('theme-icon').innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
            } else {
                html.classList.add('light-mode');
            }
            const meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.setAttribute('content', html.classList.contains('dark-mode') ? '#0A0A0C' : '#FBFBFD');
        }

        function renderArchive() {
            const content = document.getElementById('archive-content');
            if (archive.length === 0) {
                content.innerHTML = '<p style="color: var(--ink-soft); text-align: center; padding: var(--space-10); font-size: 15px;">Aucune archive pour le moment</p>';
                return;
            }
            content.innerHTML = archive.map(day => `
                <div class="archive-day">
                    <div class="archive-date">${escapeHtml(day.date)}</div>
                    <div class="archive-stats">
                        <span>${day.completed} terminées</span>
                        <span>${day.total} total</span>
                        <span>${day.total > 0 ? Math.round((day.completed / day.total) * 100) : 0}%</span>
                    </div>
                </div>
            `).join('');
        }

        // =========== CALENDAR SYSTEM ============
        function switchView(view) {
            if (view === 'day') {
                openDaySummary();
                return;
            }
            currentView = view;
            const boardContainer = document.querySelector('.board-container');
            const calendarContainer = document.getElementById('calendar-container');
            const boardBtn = document.getElementById('view-board-btn');
            const calBtn = document.getElementById('view-calendar-btn');
            const dayBtn = document.getElementById('view-day-btn');

            if (boardContainer) { boardContainer.style.display = 'none'; boardContainer.classList.add('is-hidden'); boardContainer.classList.remove('view-entering'); }
            if (calendarContainer) { calendarContainer.style.display = 'none'; calendarContainer.classList.add('is-hidden'); calendarContainer.classList.remove('is-visible', 'view-entering'); }
            if (boardBtn) boardBtn.classList.remove('active');
            if (calBtn) calBtn.classList.remove('active');
            if (dayBtn) dayBtn.classList.remove('active');

            if (view === 'board') {
                if (boardContainer) { boardContainer.style.display = ''; boardContainer.classList.remove('is-hidden'); boardContainer.classList.add('view-entering'); }
                if (boardBtn) boardBtn.classList.add('active');
                // OPTIMISATION RETOUR KANBAN : si le DOM du tableau est déjà
                // monté et qu'aucune modification n'a eu lieu pendant
                // l'absence (calendrier/journée), on restaure la vue
                // instantanément — zéro reconstruction, zéro latence.
                if (_boardMounted && !_boardNeedsRender) {
                    renderNowFocusWidget('header-now-focus', getNowFocusTask());
                    syncStatColors();
                } else {
                    renderBoard();
                }
                _boardNeedsRender = false;
                setTimeout(() => boardContainer && boardContainer.classList.remove('view-entering'), 400);
            } else {
                if (calendarContainer) { calendarContainer.style.display = 'block'; calendarContainer.classList.remove('is-hidden'); calendarContainer.classList.add('is-visible', 'view-entering'); calendarContainer.scrollTop = 0; }
                if (calBtn) calBtn.classList.add('active');
                renderCalendar();
                setTimeout(() => calendarContainer && calendarContainer.classList.remove('view-entering'), 400);
            }
            refreshStatsBarState();
        }

        function prevMonth()

 {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
            const cal = document.getElementById('calendar-container');
            if (cal) cal.scrollTop = 0;
            renderCalendar('prev');
        }

        function nextMonth() {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
            const cal = document.getElementById('calendar-container');
            if (cal) cal.scrollTop = 0;
            renderCalendar('next');
        }

        function renderCalendar(animDirection = '') {
            const grid = document.getElementById('calendar-grid');
            const header = document.getElementById('calendar-month-year');

            if (!grid || !header) return;

            const year = currentCalendarDate.getFullYear();
            const month = currentCalendarDate.getMonth();

            const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
            header.textContent = `${monthNames[month]} ${year}`;

            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const daysInMonth = lastDay.getDate();

            let startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

            const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
            let html = dayNames.map(d => `<div class="calendar-day-header">${d}</div>`).join('');

            const today = new Date();
            const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
            const currentDay = today.getDate();

            const prevMonthLast = new Date(year, month, 0);
            const prevMonthDays = prevMonthLast.getDate();
            const prevMonth = month === 0 ? 11 : month - 1;
            const prevYear = month === 0 ? year - 1 : year;
            const nextMonth = month === 11 ? 0 : month + 1;
            const nextYear = month === 11 ? year + 1 : year;

            function cellDateStr(y, m0, d) {
                return `${y}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            }

            function tasksForDate(dateStr) {
                const dayTasks = state.cards.filter(c => {
                    const d = c.startDate || c.deadline;
                    return d === dateStr;
                });
                dayTasks.sort((a, b) => {
                    const timeA = a.scheduledTime || '23:59';
                    const timeB = b.scheduledTime || '23:59';
                    return timeA.localeCompare(timeB);
                });
                return dayTasks;
            }

            function renderDayCell({ day, dateStr, isToday, outside, dayNameStr }) {
                const dayTasks = tasksForDate(dateStr);
                const MAX_VISIBLE_TASKS = 4;
                const visibleTasks = dayTasks.slice(0, MAX_VISIBLE_TASKS);
                const extraCount = dayTasks.length - visibleTasks.length;
                const cellClass = [
                    'calendar-cell',
                    isToday ? 'today' : '',
                    outside ? 'outside-month' : ''
                ].filter(Boolean).join(' ');

                return `<div class="${cellClass}" data-date="${dateStr}">
                    <div class="calendar-date" data-day-name="${dayNameStr}">${day}</div>
                    <div class="calendar-tasks">
                        ${visibleTasks.map(c => {
                            const col = state.columns.find(col => col.id === c.columnId);
                            const isCompleted = isCompletedColumn(col);
                            const color = c.categoryColor || (col ? col.color : 'var(--blue)');
                            const label = (c.scheduledTime ? c.scheduledTime + ' · ' : '') + (c.title || '');
                            return `<div class="calendar-task ${isCompleted ? 'completed' : ''}" style="border-left-color: ${color};" title="${escapeHtml(label)}" onclick="event.stopPropagation(); showTaskSummary(${c.id})">
                                ${escapeHtml(label)}
                            </div>`;
                        }).join('')}
                        ${extraCount > 0 ? `<div class="calendar-more">+${extraCount} autre${extraCount > 1 ? 's' : ''}</div>` : ''}
                    </div>
                </div>`;
            }

            for (let i = 0; i < startingDayOfWeek; i++) {
                const day = prevMonthDays - startingDayOfWeek + 1 + i;
                const dateStr = cellDateStr(prevYear, prevMonth, day);
                const dayNameStr = dayNames[i];
                html += renderDayCell({ day, dateStr, isToday: false, outside: true, dayNameStr });
            }

            for (let day = 1; day <= daysInMonth; day++) {
                const isToday = isCurrentMonth && day === currentDay;
                const dateStr = cellDateStr(year, month, day);
                const dayNameIndex = new Date(year, month, day).getDay();
                const dayNameStr = dayNames[dayNameIndex === 0 ? 6 : dayNameIndex - 1];
                html += renderDayCell({ day, dateStr, isToday, outside: false, dayNameStr });
            }

            const totalDayCells = startingDayOfWeek + daysInMonth;
            const trailing = (7 - (totalDayCells % 7)) % 7;
            for (let i = 1; i <= trailing; i++) {
                const dateStr = cellDateStr(nextYear, nextMonth, i);
                const dow = new Date(nextYear, nextMonth, i).getDay();
                const dayNameStr = dayNames[dow === 0 ? 6 : dow - 1];
                html += renderDayCell({ day: i, dateStr, isToday: false, outside: true, dayNameStr });
            }

            grid.innerHTML = html;

            grid.classList.remove('anim-slide-prev', 'anim-slide-next');
            void grid.offsetWidth;
            if (animDirection === 'prev') grid.classList.add('anim-slide-prev');
            else if (animDirection === 'next') grid.classList.add('anim-slide-next');

            if (animDirection === 'prev' || animDirection === 'next') {
                const cleanup = () => {
                    grid.classList.remove('anim-slide-prev', 'anim-slide-next');
                    grid.removeEventListener('animationend', cleanup);
                };
                grid.addEventListener('animationend', cleanup);
                setTimeout(cleanup, 400);
            }

            updateStats();
        }


        // =========== DAY VIEW — Notification avec arrière-plan flou ===========
        function openDaySummary() {
            const overlay = document.getElementById('day-container');
            if (!overlay) return;
            overlay.style.display = 'flex';
            // Force reflow then add open
            void overlay.offsetWidth;
            overlay.classList.add('open');
            overlay.classList.remove('modal-exiting');
            document.body.style.overflow = 'hidden';
            renderDaySummary();
            // Scroll to current time or 8h
            setTimeout(() => {
                const body = document.getElementById('day-notif-body');
                if (!body) return;
                const now = new Date();
                const isToday = localDateStr(now) === localDateStr(currentDayDate);
                if (!isToday) { body.scrollTop = 0; return; }
                // Défiler vers la section active (Matin/Après-midi/Soir)
                const h = now.getHours();
                const secId = h < 12 ? 'morning' : (h < 18 ? 'afternoon' : 'evening');
                const el = body.querySelector('.day-section.' + secId);
                if (el) body.scrollTo({ top: Math.max(0, el.offsetTop - 16), behavior: 'smooth' });
            }, 120);
        }

        function closeDaySummary() {
            const overlay = document.getElementById('day-container');
            if (!overlay) return;
            overlay.classList.add('modal-exiting');
            // Le tableau Kanban est rafraîchi maintenant si des chronos ont
            // changé pendant que la vue Jour était ouverte : le re-rendu est
            // masqué par le fondu de sortie de l'overlay.
            requestAnimationFrame(() => flushDeferredBoardRender());
            overlay.addEventListener('animationend', () => {
                overlay.classList.remove('open', 'modal-exiting');
                overlay.style.display = 'none';
                document.body.style.overflow = '';
            }, { once: true });
            setTimeout(() => {
                if (overlay.classList.contains('open') || overlay.classList.contains('modal-exiting')) {
                    overlay.classList.remove('open', 'modal-exiting');
                    overlay.style.display = 'none';
                    document.body.style.overflow = '';
                }
            }, 350);
        }

        function prevDay()
 {
            currentDayDate.setDate(currentDayDate.getDate() - 1);
            renderDaySummary();
        }

        function nextDay() {
            currentDayDate.setDate(currentDayDate.getDate() + 1);
            renderDaySummary();
        }

        function goToToday() {
            currentDayDate = new Date();
            renderDaySummary();
        }

        function goToDay(dateStr) {
            const parsed = parseLocalDate(dateStr);
            if (parsed) {
                currentDayDate = parsed;
                renderDaySummary();
            }
        }

        function getTasksForDay(dateStr) {
            const todayStr = localDateStr(new Date());
            return state.cards.filter(c => {
                const d = c.startDate || c.deadline;
                if (d === dateStr) return true;
                // Pour la vue du jour courant, inclure aussi les tâches sans date mais dans la colonne Aujourd'hui ou en retard
                if (dateStr === todayStr && !d) {
                    const col = state.columns.find(col => col.id === c.columnId);
                    if (!col) return false;
                    if (isCompletedColumn(col)) return false;
                    return isTodayColumn(col) || getDeadlineStatus(c.deadline, c.scheduledTime) === 'overdue';
                }
                return false;
            }).sort((a, b) => {
                const ta = a.scheduledTime || '23:59';
                const tb = b.scheduledTime || '23:59';
                return ta.localeCompare(tb);
            });
        }

        function formatDayHeader(dateObj) {
            const days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
            const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
            const dayName = days[dateObj.getDay()];
            const day = dateObj.getDate();
            const month = months[dateObj.getMonth()];
            const year = dateObj.getFullYear();
            const today = new Date(); today.setHours(0,0,0,0);
            const cmp = new Date(dateObj); cmp.setHours(0,0,0,0);
            const diff = Math.round((cmp - today) / 86400000);
            let rel = '';
            if (diff === 0) rel = "Aujourd'hui";
            else if (diff === 1) rel = 'Demain';
            else if (diff === -1) rel = 'Hier';
            else if (diff > 0 && diff < 7) rel = `Dans ${diff} jours`;
            else if (diff < 0 && diff > -7) rel = `Il y a ${Math.abs(diff)} jours`;
            return { title: `${dayName} ${day} ${month} ${year}`, subtitle: rel };
        }

        function formatDuration(mins) {
            if (!mins || mins <= 0) return '';
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            if (h > 0 && m > 0) return `${h}h ${String(m).padStart(2,'0')}`;
            if (h > 0) return `${h}h`;
            return `${m} min`;
        }

        function computeDayOverlaps(timedTasks) {
            // Sort by start minute
            const tasks = timedTasks.map(t => {
                const [h,mm] = (t.scheduledTime || '00:00').split(':').map(Number);
                const start = h*60+mm;
                const dur = t.duration ? parseInt(t.duration) : 60;
                const end = start + dur;
                return { card: t, start, end, duration: dur };
            }).sort((a,b) => a.start - b.start || a.end - b.end);

            // Cluster overlapping tasks
            const clusters = [];
            let currentCluster = [];
            let clusterMaxEnd = -1;
            tasks.forEach(item => {
                if (currentCluster.length === 0) {
                    currentCluster = [item];
                    clusterMaxEnd = item.end;
                } else {
                    if (item.start < clusterMaxEnd) {
                        currentCluster.push(item);
                        clusterMaxEnd = Math.max(clusterMaxEnd, item.end);
                    } else {
                        clusters.push(currentCluster);
                        currentCluster = [item];
                        clusterMaxEnd = item.end;
                    }
                }
            });
            if (currentCluster.length > 0) clusters.push(currentCluster);

            // For each cluster, assign lanes (greedy)
            const positioned = [];
            clusters.forEach(cluster => {
                const lanes = []; // each lane is array of items with last end
                cluster.forEach(item => {
                    let laneIdx = -1;
                    for (let i=0;i<lanes.length;i++) {
                        if (lanes[i].lastEnd <= item.start) { laneIdx = i; break; }
                    }
                    if (laneIdx === -1) {
                        laneIdx = lanes.length;
                        lanes.push({ lastEnd: item.end, items: [] });
                    }
                    lanes[laneIdx].lastEnd = Math.max(lanes[laneIdx].lastEnd, item.end);
                    lanes[laneIdx].items.push(item);
                    item.lane = laneIdx;
                    item.laneCount = null; // set later
                });
                const laneCount = lanes.length;
                cluster.forEach(item => { item.laneCount = laneCount; });
                positioned.push(...cluster);
            });
            return positioned;
        }

        // ============================================================
        // BOUTONS PLAY / PAUSE dans la vue Jour
        // Chaque tâche de la journée affiche un bouton permettant de
        // démarrer / mettre en pause son chronomètre directement depuis
        // la liste, sans ouvrir la tâche (accessibilité + simplicité).
        // ============================================================
        const DAY_TIMER_ICONS = {
            play: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
            pause: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>'
        };

        /** Format compact qui défile : MM:SS, ou H:MM:SS au-delà d'une heure. */
        function formatDayTimerClock(totalSeconds) {
            const s = Math.max(0, Math.floor(totalSeconds || 0));
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const sec = s % 60;
            const ss = String(sec).padStart(2, '0');
            if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
            return `${String(m).padStart(2, '0')}:${ss}`;
        }

        /**
         * Bouton play/pause d'une tâche de la vue Jour (+ chrono live).
         * - chrono inactif  → bouton play bleu
         * - chrono en cours → bouton pause vert + temps écoulé qui défile
         * - chrono en pause → bouton play orange + temps écoulé figé
         * isMini : version compacte pour les puces « sans horaire ».
         */
        function dayTimerButtonHtml(cardId, isMini = false) {
            const running = isTimerRunning(cardId);
            const paused = isTimerPaused(cardId);
            const stateCls = running ? 'running' : (paused ? 'paused' : 'idle');
            const label = running ? 'Mettre le chronomètre en pause' : (paused ? 'Reprendre le chronomètre' : 'Démarrer le chronomètre');
            const icon = running ? DAY_TIMER_ICONS.pause : DAY_TIMER_ICONS.play;
            const live = (!isMini && (running || paused))
                ? `<span class="dtc-live ${running ? 'running' : 'paused'}">${formatDayTimerClock(getTimerElapsed(cardId))}</span>`
                : '';
            return `${live}<button type="button" class="dtc-timer-btn ${stateCls}${isMini ? ' mini' : ''}" onclick="toggleDayTimer(${cardId}, event)" title="${label}" aria-label="${label}">${icon}</button>`;
        }

        /**
         * Mise à jour CIBLÉE : ne remplace que le bouton play/pause (et le
         * chrono live) de la tâche concernée, au lieu de reconstruire toute
         * la vue Jour. C'est ce qui rend le clic instantané.
         */
        function updateDayTimerButtons(cardId) {
            const id = Number(cardId);
            document.querySelectorAll(`.dtc-timer-zone[data-day-card="${id}"]`).forEach(zone => {
                zone.innerHTML = dayTimerButtonHtml(id, zone.dataset.dayMini === '1');
            });
        }

        /** Bascule lecture/pause du chronomètre depuis la vue Jour. */
        function toggleDayTimer(cardId, event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation(); // ne pas ouvrir la tâche au clic sur le bouton
            }
            const id = Number(cardId);
            if (isTimerRunning(id)) pauseTimer(id);
            else startTimer(id);
            // Le rafraîchissement visuel est fait par les wrappers ci-dessous
            // (mise à jour ciblée du bouton, sans re-rendu de la journée).
        }

        /**
         * Rafraîchit l'état des boutons du chrono SANS re-rendu complet :
         * 1. le ou les boutons de la tâche concernée, immédiatement ;
         * 2. les widgets « maintenant » (en-tête + jour), regroupés dans un
         *    requestAnimationFrame pour absorber les appels multiples en un
         *    seul passage (ex. stopAllTimers).
         */
        let _dayTimerRefreshQueued = false;
        function scheduleDayTimerRefresh(cardId) {
            if (cardId !== undefined && cardId !== null) updateDayTimerButtons(cardId);
            if (_dayTimerRefreshQueued) return;
            _dayTimerRefreshQueued = true;
            requestAnimationFrame(() => {
                _dayTimerRefreshQueued = false;
                refreshNowFocusWidgets();
            });
        }

        /**
         * Anti-latence : tant que la vue Jour est ouverte, inutile de
         * reconstruire le tableau Kanban (masqué derrière l'overlay) à chaque
         * play/pause. On diffère ce re-rendu à la fermeture de la vue, où il
         * est de toute façon masqué par le fondu de sortie.
         */
        let _boardRefreshPending = false;
        function renderBoardOrDefer() {
            const overlay = document.getElementById('day-container');
            if (overlay && overlay.classList.contains('open')) { _boardRefreshPending = true; return; }
            renderBoard();
        }
        function flushDeferredBoardRender() {
            if (!_boardRefreshPending) return;
            _boardRefreshPending = false;
            _skipEntranceAnimation = true;
            renderBoard();
        }

        // Les chronos peuvent être démarrés/pausés/arrêtés depuis ailleurs
        // (cartes du board, résumé de tâche, widget « maintenant »…). On
        // enveloppe les 3 fonctions pour que les boutons de la vue Jour
        // restent toujours synchronisés, quelle que soit l'origine — sans
        // re-rendu complet de la journée (source de latence au clic).
        const _dayOrigStartTimer = startTimer;
        startTimer = function(cardId, event) {
            _dayOrigStartTimer(cardId, event);
            scheduleDayTimerRefresh(cardId); // boutons vue Jour + widgets « maintenant »
            updateCardTimerUI(cardId);       // carte Kanban : mise à jour ciblée, sans renderBoard (scroll conservé)
        };
        const _dayOrigPauseTimer = pauseTimer;
        pauseTimer = function(cardId, event) {
            _dayOrigPauseTimer(cardId, event);
            scheduleDayTimerRefresh(cardId);
            updateCardTimerUI(cardId);
        };
        const _dayOrigStopTimer = stopTimer;
        stopTimer = function(cardId, event) {
            _dayOrigStopTimer(cardId, event);
            scheduleDayTimerRefresh(cardId);
            updateCardTimerUI(cardId);
        };

        function renderDaySummary() {
            const dayContainer = document.getElementById('day-container');
            if (!dayContainer) return;
            const dateStr = localDateStr(currentDayDate);
            const titleEl = document.getElementById('day-date-title');
            const subtitleEl = document.getElementById('day-date-subtitle');
            const pickerEl = document.getElementById('day-picker');
            const statsEl = document.getElementById('day-stats');
            const unscheduledEl = document.getElementById('day-unscheduled');
            const timelineEl = document.getElementById('day-timeline');

            if (pickerEl) pickerEl.value = dateStr;

            const header = formatDayHeader(currentDayDate);
            if (titleEl) titleEl.textContent = header.title;
            if (subtitleEl) subtitleEl.textContent = header.subtitle;

            const allDayTasks = getTasksForDay(dateStr);
            const timedTasks = allDayTasks.filter(t => !!t.scheduledTime);
            const unscheduledTasks = allDayTasks.filter(t => !t.scheduledTime);
            const isToday = localDateStr(new Date()) === dateStr;
            renderNowFocusWidget('day-now-focus', getNowFocusTask(dateStr, {
                includeLiveTimers: isToday,
                dayContext: true
            }));

            // === Jauge de progression + message d'état ===
            const greetingEl = document.getElementById('day-greeting');
            const greetingText = document.getElementById('day-greeting-text');
            const progressWrap = document.getElementById('day-progress');
            const progressFill = document.getElementById('day-progress-fill');
            const progressLabel = document.getElementById('day-progress-label');

            // Stats
            let totalMins = 0;
            timedTasks.forEach(t => totalMins += (t.duration ? parseInt(t.duration) : 60));
            const completedCol = findColumnByRole('completed');
            const completedCount = allDayTasks.filter(c => completedCol && c.columnId === completedCol.id).length;
            const remainingCount = allDayTasks.length - completedCount;
            const overdueCount = allDayTasks.filter(c => {
                const col = state.columns.find(col => col.id === c.columnId);
                if (isCompletedColumn(col)) return false;
                const s = getDeadlineStatus(c.deadline, c.scheduledTime);
                return s === 'overdue';
            }).length;

            // Remplir la jauge et le message d'état
            if (greetingEl && greetingText) {
                greetingEl.classList.remove('is-done','is-empty');
                let ico = dayIcons.wave, msg = '';
                if (allDayTasks.length === 0) {
                    greetingEl.classList.add('is-empty'); ico = dayIcons.calendar;
                    msg = 'Aucune tâche prévue — profites-en pour ajouter quelque chose.';
                } else if (remainingCount === 0 && completedCount > 0) {
                    greetingEl.classList.add('is-done'); ico = dayIcons.checkCircle;
                    msg = 'Journée terminée ! ' + completedCount + ' tâche' + (completedCount>1?'s':'') + ' accomplie' + (completedCount>1?'s':'') + '.';
                } else if (overdueCount > 0) {
                    ico = dayIcons.alert;
                    msg = overdueCount + ' tâche' + (overdueCount>1?'s':'') + ' en retard · ' + remainingCount + ' restante' + (remainingCount>1?'s':'') + '.';
                } else if (isToday) {
                    ico = dayIcons.sun;
                    msg = remainingCount + ' tâche' + (remainingCount>1?'s':'') + ' à faire aujourd\'hui.';
                } else {
                    ico = dayIcons.calendar;
                    msg = remainingCount + ' tâche' + (remainingCount>1?'s':'') + ' prévue' + (remainingCount>1?'s':'') + ' ce jour.';
                }
                greetingEl.querySelector('.dg-ico').innerHTML = ico;
                greetingText.textContent = msg;
            }
            if (progressWrap && progressFill && progressLabel) {
                if (allDayTasks.length > 0) {
                    const pct = Math.round((completedCount / allDayTasks.length) * 100);
                    progressWrap.style.display = 'flex';
                    progressFill.style.width = pct + '%';
                    progressLabel.textContent = completedCount + '/' + allDayTasks.length + ' terminées';
                } else {
                    progressWrap.style.display = 'none';
                }
            }

            if (statsEl) {
                const hours = Math.floor(totalMins / 60);
                const mins = totalMins % 60;
                const timeStr = hours > 0 ? `${hours}h ${mins > 0 ? String(mins).padStart(2,'0') : '00'}` : `${mins} min`;
                statsEl.innerHTML = `
                    <div class="day-stat-card">
                        <div class="day-stat-value">${allDayTasks.length}</div>
                        <div class="day-stat-label">Tâches</div>
                    </div>
                    <div class="day-stat-card">
                        <div class="day-stat-value">${timedTasks.length > 0 ? timeStr : '—'}</div>
                        <div class="day-stat-label">Temps planifié</div>
                    </div>
                    <div class="day-stat-card">
                        <div class="day-stat-value" style="color:${remainingCount>0 ? 'var(--blue)' : 'var(--ink)'}">${remainingCount}</div>
                        <div class="day-stat-label">À faire</div>
                    </div>
                    <div class="day-stat-card">
                        <div class="day-stat-value" style="color:${completedCount>0 ? 'var(--sys-green)' : 'var(--ink)'}">${completedCount}</div>
                        <div class="day-stat-label">Terminées</div>
                    </div>
                    ${overdueCount>0 ? `<div class="day-stat-card" style="border-color: rgba(255,59,48,0.3);"><div class="day-stat-value" style="color: var(--sys-red);">${overdueCount}</div><div class="day-stat-label">En retard</div></div>` : ''}
                `;
            }

            // Unscheduled
            if (unscheduledEl) {
                if (unscheduledTasks.length > 0) {
                    unscheduledEl.style.display = 'block';
                    unscheduledEl.innerHTML = `
                        <div class="day-unscheduled-title">
                            <span>Sans horaire · ${unscheduledTasks.length}</span>
                            <span style="font-weight:400; text-transform:none; font-size:11px; opacity:0.7;">Cliquer pour ouvrir</span>
                        </div>
                        <div class="day-unscheduled-list">
                            ${unscheduledTasks.map(c => {
                                const col = state.columns.find(col => col.id === c.columnId);
                                const color = c.categoryColor || (col ? col.color : 'var(--blue)');
                                const isComp = completedCol && c.columnId === completedCol.id;
                                return `<div class="day-unscheduled-chip ${isComp ? 'completed' : ''}" onclick="showTaskSummary(${c.id})" title="${escapeHtml(c.title)}">
                                    <span class="dot" style="background:${color}"></span>
                                    <span style="${isComp ? 'text-decoration:line-through; opacity:0.6;' : ''}">${escapeHtml(c.title)}</span>
                                    ${c.duration ? `<span style="font-size:10px; background:var(--bg-alt); padding:2px 6px; border-radius:6px;">${formatDuration(c.duration)}</span>` : ''}
                                    ${isComp ? '' : `<span class="dtc-timer-zone" data-day-card="${c.id}" data-day-mini="1">${dayTimerButtonHtml(c.id, true)}</span>`}
                                </div>`;
                            }).join('')}
                        </div>
                    `;
                } else {
                    unscheduledEl.style.display = 'none';
                    unscheduledEl.innerHTML = '';
                }
            }

            // === Vue par sections : Matin / Après-midi / Soir ===
            if (!timelineEl) return;

            const SECTIONS = [
                { id: 'morning',   icon: dayIcons.sunrise, title: 'Matin',       start: 5,  end: 12 },
                { id: 'afternoon', icon: dayIcons.sun, title: 'Après-midi',  start: 12, end: 18 },
                { id: 'evening',   icon: dayIcons.moon, title: 'Soir',        start: 18, end: 24 }
            ];
            const now = new Date();
            const nowMins = now.getHours()*60 + now.getMinutes();

            const positioned = computeDayOverlaps(timedTasks);
            // Regrouper les tâches positionnées par section (selon leur début)
            const bySection = { morning: [], afternoon: [], evening: [], night: [] };
            positioned.forEach(item => {
                if (item.start < 5*60) bySection.night.push(item);
                else if (item.start < 12*60) bySection.morning.push(item);
                else if (item.start < 18*60) bySection.afternoon.push(item);
                else bySection.evening.push(item);
            });
            // Les tâches très tôt (avant 5h) vont dans le matin
            bySection.morning = bySection.night.concat(bySection.morning);

            const renderTaskRow = (item) => {
                const card = item.card;
                const col = state.columns.find(col => col.id === card.columnId);
                const isComp = completedCol && card.columnId === completedCol.id;
                const baseColor = card.categoryColor || (col ? col.color : '#0A84FF');
                const prioClass = card.priority || 'medium';
                const [hh,mm] = (card.scheduledTime || '00:00').split(':');
                const durLabel = formatDuration(item.duration);
                const showDesc = item.duration >= 45 && card.description;
                const subParts = [];
                if (card.category) subParts.push(`<span class="dtc-cat"><span class="dtc-dot" style="background:${baseColor}"></span>${escapeHtml(card.category)}</span>`);
                if (durLabel) subParts.push(`<span>${durLabel}</span>`);
                if (showDesc) subParts.push(`<span style="opacity:.8">${escapeHtml((card.description||'').substring(0,60))}</span>`);
                return `
                    <div class="day-task-row" data-card-id="${card.id}" onclick="handleDayTaskRowClick(${card.id})">
                        <div class="day-task-time">
                            <span class="dt-h">${hh}:${mm}</span>
                            ${durLabel ? `<span class="dt-dur">${durLabel}</span>` : ''}
                        </div>
                        <div class="day-task-card ${isComp ? 'completed' : ''}" style="border-left-color:${baseColor}">
                            <span class="dtc-prio ${prioClass}"></span>
                            <div class="dtc-main">
                                <div class="dtc-title">${escapeHtml(card.title)}</div>
                                ${subParts.length ? `<div class="dtc-sub">${subParts.join('')}</div>` : ''}
                            </div>
                            ${isComp ? '' : `<span class="dtc-timer-zone" data-day-card="${card.id}">${dayTimerButtonHtml(card.id)}</span>`}
                            <svg class="dtc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </div>
                    </div>`;
            };

            let sectionsHTML = '';
            SECTIONS.forEach(sec => {
                const items = bySection[sec.id];
                const startMins = sec.start*60, endMins = sec.end*60;
                const isNow = isToday && nowMins >= startMins && nowMins < endMins;
                const count = items.length;
                const timeLabel = `${String(sec.start).padStart(2,'0')}:00 – ${sec.end===24?'00':String(sec.end).padStart(2,'0')}:00`;
                let rows = items.map(renderTaskRow).join('');
                if (!rows) {
                    rows = `<div class="day-task-row" onclick="showAddCardModalAt('${dateStr}', '${String(sec.start).padStart(2,'0')}:00')">
                        <div class="day-empty-slot" style="grid-column:1 / -1;">Aucune tâche · cliquer pour ajouter à ${String(sec.start).padStart(2,'0')}:00</div>
                    </div>`;
                }
                let nowBanner = '';
                if (isNow) {
                    const nowStr = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
                    nowBanner = `<div class="day-now-banner"><span class="pulse"></span> Maintenant · ${nowStr}</div>`;
                }
                sectionsHTML += `
                    <section class="day-section ${isNow ? 'is-now' : ''}">
                        <div class="day-section-head">
                            <span class="day-section-icon">${sec.icon}</span>
                            <span class="day-section-title">${sec.title}</span>
                            <span class="day-section-meta">${count} tâche${count>1?'s':''} · ${timeLabel}</span>
                        </div>
                        ${nowBanner}
                        <div class="day-task-grid">${rows}</div>
                    </section>`;
            });

            // Bouton d'ajout global en bas
            const addHint = `<div class="day-add-hint" onclick="showAddCardModalAt('${dateStr}', '${String(Math.max(8, Math.min(20, new Date().getHours()))).padStart(2,'0')}:00')">
                ${dayIcons.plus}
                Ajouter une tâche
            </div>`;

            timelineEl.innerHTML = `<div class="day-sections">${sectionsHTML}${addHint}</div>`;
            initDayDragDrop();
        }

        // ============================================================
        // DRAG & DROP de la journée — réorganiser une tâche entre deux
        // autres et recalculer automatiquement les heures de départ
        // quand la plage horaire le permet (reflow "compact").
        // ============================================================
        let daySortableInstances = [];
        let dayDragInProgress = false;

        function minsToHHMM(mins) {
            mins = Math.max(0, Math.min(1439, Math.round(mins)));
            const h = Math.floor(mins / 60), m = mins % 60;
            return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
        }
        function timeToMins(t) {
            const p = (t || '00:00').split(':').map(Number);
            return (p[0] || 0) * 60 + (p[1] || 0);
        }

        // Recalcule les heures de départ de toute la journée dans le nouvel
        // ordre, en ne décalant une tâche que si son créneau est déjà occupé.
        function computeDayReflow(orderedCards, draggedId) {
            const starts = orderedCards.map(c => timeToMins(c.scheduledTime));
            const dayStart = Math.min(...starts);
            let prevEnd = null;
            const res = {};
            orderedCards.forEach(c => {
                const dur = c.duration ? parseInt(c.duration) : 60;
                let start;
                if (prevEnd === null) {
                    start = dayStart;                 // ancre la journée sur l'heure la plus tôt
                } else if (c.id === draggedId) {
                    start = prevEnd;                  // la tâche déplacée comble le créneau juste après la précédente
                } else {
                    start = Math.max(timeToMins(c.scheduledTime), prevEnd); // garde l'heure, sinon décale pour que ça tienne
                }
                res[c.id] = start;
                prevEnd = start + dur;
            });
            return res;
        }

        function onDayDragEnd(evt) {
            try {
                const dateStr = localDateStr(currentDayDate);
                const container = document.getElementById('day-container');
                if (!container) return;
                const draggedId = evt.item ? parseInt(evt.item.getAttribute('data-card-id')) : null;

                // Nouvel ordre visuel réel : SortableJS a déjà déplacé le nœud,
                // on lit donc toutes les lignes de la journée dans l'ordre du DOM.
                const orderedIds = [];
                container.querySelectorAll('.day-task-row[data-card-id]').forEach(row => {
                    const id = parseInt(row.getAttribute('data-card-id'));
                    if (!isNaN(id)) orderedIds.push(id);
                });

                const byId = {};
                getTasksForDay(dateStr).forEach(c => byId[c.id] = c);
                const ordered = orderedIds.map(id => byId[id]).filter(Boolean);
                if (ordered.length === 0) { renderDaySummary(); return; }

                const reflow = computeDayReflow(ordered, draggedId);
                let changed = false;
                ordered.forEach(c => {
                    const newTime = minsToHHMM(reflow[c.id]);
                    if (c.scheduledTime !== newTime) { c.scheduledTime = newTime; changed = true; }
                });

                if (changed) {
                    saveState();
                    const moved = byId[draggedId];
                    showToast('Journée réorganisée · ' + (moved ? moved.title : 'tâche') + ' replacée et horaires ajustés');
                }
                renderDaySummary();
            } catch (e) {
                console.error('Erreur réorganisation journée:', e);
                renderDaySummary();
            }
            // Réinitialise le drapeau APRÈS le clic éventuel déclenché par le
            // relâchement du drag, pour qu'il ne soit pas interprété comme un clic.
            setTimeout(() => { dayDragInProgress = false; }, 0);
        }

        // Ouvre la tâche, sauf si un drag & drop vient de se terminer.
        function handleDayTaskRowClick(cardId) {
            if (dayDragInProgress) return;
            showTaskSummary(cardId);
        }

        function initDayDragDrop() {
            try {
                daySortableInstances.forEach(s => { try { s.destroy(); } catch (e) {} });
                daySortableInstances = [];
                if (typeof Sortable === 'undefined') return;
                document.querySelectorAll('.day-task-grid').forEach(grid => {
                    const inst = new Sortable(grid, {
                        group: { name: 'day-tasks', pull: true, put: true },
                        draggable: '.day-task-row[data-card-id]',
                        // La tâche entière est draggable. Un très court délai suffit
                        // à distinguer un clic (ouvre la tâche) d'un vrai déplacement :
                        // le drag démarre dès que le pointeur bouge après ce délai.
                        delay: 40,
                        delayOnTouchOnly: false,
                        touchStartThreshold: 3,
                        animation: 180,
                        easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
                        ghostClass: 'day-row-dragging',
                        chosenClass: 'day-row-chosen',
                        dragClass: 'day-row-drag',
                        fallbackTolerance: 3,
                        onStart: function() {
                            dayDragInProgress = true;
                            document.querySelectorAll('.day-task-grid').forEach(g => g.classList.add('day-grid-drop-target'));
                        },
                        onEnd: onDayDragEnd,
                        onMove: function() { return true; }
                    });
                    daySortableInstances.push(inst);
                });
            } catch (e) {
                console.error('Erreur init drag & drop journée:', e);
            }
        }

        function handleDayTrackClick(event) {
            // Conservé pour compatibilité : la création se fait via les
            // créneaux vides et le bouton "Ajouter une tâche".
            if (event.target.closest('.day-task-card') || event.target.closest('.day-task-row')) return;
            const dateStr = localDateStr(currentDayDate);
            const now = new Date();
            const h = String(Math.max(8, Math.min(20, now.getHours()))).padStart(2,'0');
            showAddCardModalAt(dateStr, h + ':00');
        }

        function showAddCardModalAt(dateStr, timeStr) {
            const todayCol = findColumnByRole('today') || state.columns[0];
            if (!todayCol) { showToast('Colonne introuvable'); return; }
            showAddCardModal(todayCol.id, 'scheduled');
            setTimeout(() => {
                const dateInput = document.getElementById('card-start-date');
                const timeInput = document.getElementById('card-scheduled-time');
                if (dateInput) dateInput.value = dateStr;
                if (timeInput) timeInput.value = timeStr;
                const titleInput = document.getElementById('card-title');
                if (titleInput) titleInput.focus();
            }, 80);
        }

        // Ensure day view refreshes when data changes
        const _origRenderBoardForDay = renderBoard;
        // Monkey patch saveState triggers? We'll call renderDay in key places via a helper
        function refreshCurrentView() {
            if (currentView === 'day') renderDaySummary();
            else if (currentView === 'calendar') renderCalendar();
            else renderBoard();
        }

        // Override relevant functions to auto-refresh day view
        const _origUpdateStats = updateStats;
        updateStats = function() {
            _origUpdateStats();
            const dayOverlay = document.getElementById('day-container');
            if (dayOverlay && dayOverlay.classList.contains('open')) {
                renderDaySummary();
            }
        };

        const _origCreateCard = createCard;
        // Keep original but also refresh day after (original already does renderBoard/updateStats, which now triggers day refresh)


                // =========== MODAL SYSTEM ============
        function syncRunningTimers() {
            Object.keys(activeTimers).forEach(cardId => {
                const id = Number(cardId);
                const timer = activeTimers[id];
                if (timer && timer.startTime) {
                    const card = state.cards.find(c => c.id === id);
                    if (card) {
                        const now = Date.now();
                        const sessionSeconds = Math.floor((now - timer.startTime) / 1000);
                        if (sessionSeconds > 0) {
                            card.totalTimeSpent = (card.totalTimeSpent || 0) + sessionSeconds;
                            timer.elapsed += sessionSeconds;
                            timer.startTime = now;
                        }
                    }
                }
            });
        }

        function syncWithRoot(options) {
            // options.write === false  => passage en LECTURE SEULE (poll rapide) :
            // on regarde seulement si le fichier Root a changé, sans le réécrire.
            const allowWrite = !(options && options.write === false);
            enqueueIO(async () => {
                if (!dataFileHandle) {
                    if (!allowWrite) return;
                    syncRunningTimers();
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                    return;
                }
                try {
                    const file = await dataFileHandle.getFile();
                    // Le fichier a-t-il été touché par quelqu'un d'autre ?
                    let texteExterne = null;
                    const verifProfonde = (++pollTick % ROOT_SYNC.deepCheckEvery) === 0;
                    if (window.VN_DEBUG) console.log('[sync] check lm=' + file.lastModified + ' connu=' + lastModifiedTime + (verifProfonde ? ' (profonde)' : ''));
                    if (lastModifiedTime > 0 && (file.lastModified !== lastModifiedTime || verifProfonde)) {
                        const texteDisque = await file.text();
                        if (window.VN_DEBUG) console.log('[sync] diff détectée, hash disque=' + contentHash(texteDisque) + ' notre signature=' + lastWrittenSignature);
                        if (contentHash(texteDisque) === lastWrittenSignature) {
                            // C'est notre propre écriture (horodatage réajusté par l'OS,
                            // client de synchro cloud, etc.) : rien à recharger.
                            lastModifiedTime = file.lastModified;
                        } else {
                            texteExterne = texteDisque;
                        }
                    }
                    if (texteExterne !== null) {
                        const pendingTime = {};
                        Object.keys(activeTimers).forEach(id => {
                            const timer = activeTimers[id];
                            if (timer && timer.startTime) {
                                pendingTime[id] = Math.floor((Date.now() - timer.startTime) / 1000);
                                timer.startTime = Date.now();
                            }
                        });

                        const dataText = texteExterne;
                        let doitReecrire = false;
                        if (dataText) {
                            // Fusion 3 voies : ni notre travail ni celui d'en face n'est perdu.
                            const res = integrerContenuDisque(dataText);
                            doitReecrire = res.doitReecrire;
                            migrateLegacyColumns();
                        }
                        lastModifiedTime = file.lastModified;

                        let timeReapplied = false;
                        Object.keys(pendingTime).forEach(id => {
                            const card = state.cards.find(c => c.id === Number(id));
                            if (card && pendingTime[id] > 0) {
                                card.totalTimeSpent = (card.totalTimeSpent || 0) + pendingTime[id];
                                timeReapplied = true;
                            }
                        });

                        const activeIds = Object.keys(activeTimers).map(Number);
                        activeIds.forEach(id => {
                            if (!state.cards.find(c => c.id === id)) {
                                if (timerIntervals[id]) clearInterval(timerIntervals[id]);
                                delete activeTimers[id];
                            }
                        });

                        renderBoard();
                        updateStats();
                        showToast('<svg style="width:14px;height:14px;vertical-align:-2px;display:inline-block" viewBox="0 0 24 24" fill="none" stroke="var(--sys-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg> Synchronisé avec le dossier Root');

                        // Si la fusion a produit un résultat différent du fichier
                        // (nos ajouts locaux, un temps de chrono réappliqué…),
                        // on le réécrit pour que les deux côtés convergent.
                        if (timeReapplied || doitReecrire) {
                            const stateCopy = JSON.stringify(state, null, 2);
                            const newFile = await writeThroughHandle(dataFileHandle, stateCopy);
                            lastModifiedTime = newFile.lastModified;
                            lastWrittenSignature = contentHash(stateCopy);
                            lastKnownFileText = stateCopy;
                            broadcastRootWrite();
                        }

                    } else {
                        // Poll rapide : rien de neuf dans le dossier Root, on n'écrit pas
                        // (évite d'écraser le fichier toutes les secondes).
                        if (!allowWrite) return;
                        syncRunningTimers();
                        state.version = DATA_VERSION;
                        const stateCopy = JSON.stringify(state, null, 2);
                        // Battement de coeur (30 s) : n'écrire que si le contenu a
                        // réellement changé, sinon on touche le fichier pour rien.
                        if (contentHash(stateCopy) === lastWrittenSignature) return;
                        const newFile = await writeThroughHandle(dataFileHandle, stateCopy);
                        lastModifiedTime = newFile.lastModified;
                        lastWrittenSignature = contentHash(stateCopy);
                        lastKnownFileText = stateCopy;
                        broadcastRootWrite();
                    }
                } catch (e) {
                    console.error("Erreur de synchronisation auto:", e);
                    if (e.name === 'NotAllowedError' || e.name === 'NotFoundError') {
                        showToast('<svg style="width:14px;height:14px;vertical-align:-2px;display:inline-block" viewBox="0 0 24 24" fill="none" stroke="var(--sys-orange)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Connexion au dossier perdue. Sauvegarde locale activée.');
                        dataFileHandle = null;
                        archiveFileHandle = null;
                        syncRunningTimers();
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                        localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
                    }
                }
            });
        }


        /* ============================================================
           SYNC INSTANTANÉE AVEC LE DOSSIER ROOT  (VN Live Sync)
           3 canaux complémentaires :
             1) FileSystemObserver  -> notification native ~immédiate quand
                kanban-data.json change sur le disque (Chrome/Edge 133+ desktop)
             2) BroadcastChannel    -> propagation instantanée entre onglets /
                fenêtres de la même machine (< 50 ms)
             3) Poll rapide adaptatif -> filet de sécurité (1 s onglet actif,
                10 s onglet en arrière-plan) + réveil sur focus/visibilité
           ============================================================ */
        const ROOT_SYNC = {
            activeMs: 1000,      // fréquence de vérification quand l'onglet est visible
            hiddenMs: 10000,     // fréquence quand l'onglet est en arrière-plan
            debounceMs: 120,     // regroupement des notifications rapprochées
            deepCheckEvery: 8    // toutes les N vérifications, comparer le CONTENU
                                 // (certains systèmes de fichiers ont un horodatage
                                 //  imprécis : FAT32 = 2 s, partages réseau, clients cloud)
        };
        let pollTick = 0;
        // Empreinte du dernier contenu écrit par CET onglet.
        // Elle remplace l'ancienne marge temporelle (« ignorer si modifié il y a
        // moins de 2 s ») qui faisait manquer les modifications rapprochées :
        // deux onglets qui écrivent coup sur coup ne se voyaient pas.
        let lastWrittenSignature = '';
        function contentHash(text) {
            let h = 5381;
            for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
            return text.length + ':' + (h >>> 0).toString(36);
        }
        const VN_TAB_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);
        let rootChannel = null;
        let rootObserver = null;
        let rootPollTimer = null;
        let rootSyncDebounce = null;
        let rootWatchStarted = false;
        let rootSyncMode = 'aucun';

        // Point d'entrée de diagnostic / test (lecture seule côté app).
        window.VN_SYNC = {
            config: ROOT_SYNC,
            tabId: VN_TAB_ID,
            get mode() { return rootSyncMode; },
            get hasRoot() { return !!dataFileHandle; },
            get lastModifiedTime() { return lastModifiedTime; },
            get state() { return state; },
            get archive() { return archive; },
            flush: () => ioQueue,
            check: (reason) => requestRootSync(reason || 'manuel'),
            stats: { externalReloads: 0, writes: 0, polls: 0, errors: 0 }
        };

        function broadcastRootWrite() {
            try {
                if (rootChannel) rootChannel.postMessage({ type: 'root-write', id: VN_TAB_ID, at: Date.now() });
            } catch (e) { /* canal fermé : ignoré */ }
        }

        // Déclenche une vérification instantanée (débouncée) du dossier Root.
        function requestRootSync(reason) {
            if (rootSyncDebounce) clearTimeout(rootSyncDebounce);
            rootSyncDebounce = setTimeout(() => {
                rootSyncDebounce = null;
                if (dataFileHandle) {
                    syncWithRoot({ write: false });
                } else {
                    reloadFromLocalStorage();
                }
            }, ROOT_SYNC.debounceMs);
        }

        // Mode sans dossier Root : recharge la base locale modifiée par un autre onglet.
        function reloadFromLocalStorage() {
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (!saved) return;
                const parsed = JSON.parse(saved);
                if (JSON.stringify(state) === saved) return;
                state = (parsed.version === DATA_VERSION) ? parsed : migrateData(parsed);
                migrateLegacyColumns();
                renderBoard();
                updateStats();
            } catch (e) {
                console.warn('Rechargement local impossible:', e);
            }
        }

        function scheduleRootPoll() {
            if (rootPollTimer) clearTimeout(rootPollTimer);
            const delay = document.hidden ? ROOT_SYNC.hiddenMs : ROOT_SYNC.activeMs;
            rootPollTimer = setTimeout(async () => {
                try {
                    if (dataFileHandle) {
                        syncWithRoot({ write: false });
                    }
                } finally {
                    scheduleRootPoll();
                }
            }, delay);
        }

        function onRootWake() {
            if (!document.hidden) requestRootSync('wake');
            scheduleRootPoll();
        }

        async function attachRootObserver() {
            // 1) Observation native du dossier Root (peut être branchée plus tard,
            // par ex. si l'utilisateur connecte le dossier après un démarrage local).
            if (rootObserver || !dirHandle) return;
            if (typeof window.FileSystemObserver === 'undefined') return;
            try {
                rootObserver = new FileSystemObserver(() => requestRootSync('observer'));
                await rootObserver.observe(dirHandle, { recursive: false });
                rootSyncMode = 'instantané (FileSystemObserver)';
                console.log('VN Live Sync : observateur natif branché sur le dossier Root');
            } catch (e) {
                console.warn('FileSystemObserver indisponible, repli sur le poll rapide:', e);
                rootObserver = null;
            }
        }

        async function startRootWatch() {
            if (rootWatchStarted) { await attachRootObserver(); return; }
            rootWatchStarted = true;

            // 2) Canal inter-onglets (fonctionne aussi en mode local sans dossier)
            if ('BroadcastChannel' in window) {
                try {
                    rootChannel = new BroadcastChannel('vn-root-sync');
                    rootChannel.onmessage = (event) => {
                        const msg = event.data;
                        if (!msg || msg.type !== 'root-write' || msg.id === VN_TAB_ID) return;
                        requestRootSync('broadcast');
                    };
                    rootSyncMode = 'onglets';
                } catch (e) { rootChannel = null; }
            }

            // Mode local : l'événement storage prévient aussi les autres onglets
            window.addEventListener('storage', (e) => {
                if (!dataFileHandle && e.key === STORAGE_KEY) requestRootSync('storage');
            });

            await attachRootObserver();
            if (!rootObserver && dirHandle) {
                rootSyncMode = 'quasi-instantané (poll ' + (ROOT_SYNC.activeMs / 1000) + ' s)';
            }

            // 3) Poll rapide + réveils
            scheduleRootPoll();
            window.addEventListener('focus', onRootWake);
            document.addEventListener('visibilitychange', onRootWake);
            window.addEventListener('beforeunload', () => {
                try { if (rootObserver) rootObserver.disconnect(); } catch (e) {}
                try { if (rootChannel) rootChannel.close(); } catch (e) {}
            });

            console.log('VN Live Sync actif —', rootSyncMode, '| tab', VN_TAB_ID);
            if (dirHandle) setTimeout(() => showToast('Sync Root : ' + rootSyncMode), 1400);
        }

        function createModal(title, body, buttons) {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

            let footerHTML = '';
            if (buttons.length > 0) {
                footerHTML = '<div class="modal-footer">' +
                    buttons.map(btn => `<button class="btn ${btn.class}" onclick="${btn.onclick}">${btn.text}</button>`).join('') +
                    '</div>';
            }

            overlay.innerHTML = `
                <div class="modal">
                    <div class="modal-header">
                        <div class="modal-title">${escapeHtml(title)}</div>
                        <button class="modal-close" onclick="closeModal()">×</button>
                    </div>
                    <div class="modal-body">${body}</div>
                    ${footerHTML}
                </div>
            `;
            return overlay;
        }

        function closeModal() {
            // Fermer le pop-up d'un déplacement en attente (croix, clic hors
            // cadre, touche Échap) annule ce déplacement.
            if (_pendingColumnMove) { cancelColumnMove(); return; }
            const modals = document.querySelectorAll('.modal-overlay');
            if (modals.length > 0) {
                const lastModal = modals[modals.length - 1];
                const hadCardTitle = !!lastModal.querySelector('#card-title');
                lastModal.classList.add('modal-exiting');
                lastModal.addEventListener('animationend', () => {
                    lastModal.remove();
                    if (document.querySelectorAll('.modal-overlay').length === 0) {
                        closeCardMenu();
                    }
                }, { once: true });
                // Fallback removal after animation duration
                setTimeout(() => {
                    if (lastModal.parentNode) lastModal.remove();
                }, 350);
                if (hadCardTitle && typeof _notesPendingEmbed !== 'undefined' && _notesPendingEmbed) {
                    const pendingAtClose = _notesPendingEmbed;
                    setTimeout(()=>{ if (_notesPendingEmbed === pendingAtClose) { _notesPendingEmbed = null; if (typeof _taskPickerBlockId !== 'undefined' && pendingAtClose.blockId) _taskPickerBlockId = null; } }, 1200);
                }
            }
        }

        function closeAllModals() {
            if (_pendingColumnMove) cancelColumnMove();
            document.querySelectorAll('.modal-overlay').forEach(m => {
                m.classList.add('modal-exiting');
                m.addEventListener('animationend', () => m.remove(), { once: true });
                setTimeout(() => { if (m.parentNode) m.remove(); }, 350);
            });
            closeCardMenu();
            // Notes: si une création de tâche depuis une note est en attente mais que l'utilisateur ferme sans créer, on nettoie après un délai (laisse le temps à createCard de consommer le pending)
            if (typeof _notesPendingEmbed !== 'undefined' && _notesPendingEmbed) {
                const pendingAtClose = _notesPendingEmbed;
                setTimeout(()=>{
                    if (_notesPendingEmbed === pendingAtClose) {
                        // Si aucune carte n'a été intégrée, on abandonne l'attente
                        _notesPendingEmbed = null;
                        if (typeof _taskPickerBlockId !== 'undefined' && pendingAtClose.blockId) _taskPickerBlockId = null;
                    }
                }, 1200);
            }
        }

        // =========== UTILITIES ============
        function escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function escapeCsv(text) {
            if (!text) return '';
            return text.replace(/"/g, '""');
        }

        // Empilement des notifications : plusieurs messages simultanés se
        // superposaient au même endroit et devenaient illisibles.
        const toastsActifs = [];
        function repositionnerToasts() {
            toastsActifs.forEach((t, i) => { t.style.bottom = (30 + i * 56) + 'px'; });
        }

        function showToast(message) {
            // évite les doublons consécutifs (ex. deux « Tâche créée » d'affilée)
            const dernier = toastsActifs[toastsActifs.length - 1];
            if (dernier && dernier.innerHTML === message) return;
            const toast = document.createElement('div');
            toast.className = 'toast toast-enter';
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            toast.setAttribute('aria-atomic', 'true');
            toast.innerHTML = message;
            document.body.appendChild(toast);
            toastsActifs.push(toast);
            // 3 messages visibles au maximum
            while (toastsActifs.length > 3) {
                const vieux = toastsActifs.shift();
                if (vieux && vieux.parentNode) vieux.remove();
            }
            repositionnerToasts();
            const retirer = () => {
                const i = toastsActifs.indexOf(toast);
                if (i >= 0) toastsActifs.splice(i, 1);
                if (toast.parentNode) toast.remove();
                repositionnerToasts();
            };
            // Trigger enter animation on next frame
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    toast.classList.remove('toast-enter');
                });
            });
            setTimeout(() => {
                toast.classList.add('toast-exit');
                toast.addEventListener('transitionend', retirer, { once: true });
                setTimeout(retirer, 300);
            }, 3000);
        }

        // =========== COLUMN COLOR SYSTEM ============
        const COLUMN_COLORS = [
            '#6E6E73',
            '#0071E3',
            '#34C759',
            '#FF9500',
            '#FF3B30',
            '#5856D6',
            '#AF52DE',
            '#FF2D55',
            '#FFCC00',
            '#32ADE6',
            '#00C7BE',
            '#FF6482',
        ];

        function changeColumnColor(columnId) {
            const column = state.columns.find(c => c.id === columnId);
            if (!column) return;

            const currentColor = column.color || '#6E6E73';
            const currentIndex = COLUMN_COLORS.indexOf(currentColor);
            const nextIndex = (currentIndex + 1) % COLUMN_COLORS.length;
            column.color = COLUMN_COLORS[nextIndex];
            saveState();
            renderBoard();
            showToast('Couleur de la colonne modifiée');
        }

        function createDefaultColumns() {
            state.columns = [
                { id: 1, title: 'Hier', color: '#FF9500' },
                { id: 2, title: "Aujourd'hui", color: '#0071E3' },
                { id: 3, title: 'Dans la semaine', color: '#5856D6' },
                { id: 4, title: 'Mois prochain', color: '#AF52DE' },
                { id: 5, title: 'Terminé', color: '#34C759' }
            ];
            state.nextColumnId = 6;
            saveState();
        }

        // =========== COLUMN SEARCH & FILTER ============
        let columnFilterState = {};

        function toggleColumnFilter(columnId) {
            const bar = document.getElementById(`filter-bar-${columnId}`);
            const btn = document.getElementById(`filter-btn-${columnId}`);
            if (!bar) return;

            const isClosed = bar.style.display === 'none' || bar.classList.contains('filter-bar-closed');

            if (!isClosed) {
                bar.classList.add('filter-bar-closed');
                setTimeout(() => { bar.style.display = 'none'; }, 300);
                clearColumnFilter(columnId);
            } else {
                bar.style.display = 'flex';
                setTimeout(() => {
                    bar.classList.remove('filter-bar-closed');
                    const input = document.getElementById(`filter-search-${columnId}`);
                    if (input) input.focus();
                }, 10);
            }
            if (btn) btn.classList.toggle('active', isClosed && hasColumnFilterActive(columnId));
        }

        function hasColumnFilterActive(columnId) {
            const state = columnFilterState[columnId];
            return state && (state.keyword || state.startDate || state.endDate || state.prioFilter || state.statFilter);
        }

                function applyColumnFilterOptimized(columnId) {
            const searchInput = document.getElementById(`filter-search-${columnId}`);
            const dateStart = document.getElementById(`filter-date-start-${columnId}`);
            const dateEnd = document.getElementById(`filter-date-end-${columnId}`);
            const priority = document.getElementById(`filter-priority-${columnId}`);
            const status = document.getElementById(`filter-status-${columnId}`);
            if (!searchInput) return;
            const keyword = searchInput.value.toLowerCase().trim();
            const startDate = dateStart ? dateStart.value : '';
            const endDate = dateEnd ? dateEnd.value : '';
            const prioFilter = priority ? priority.value : '';
            const statFilter = status ? status.value : '';
            columnFilterState[columnId] = { keyword, startDate, endDate, prioFilter, statFilter };
            const columnEl = document.querySelector(`.column[data-column-id="${columnId}"]`);
            const cardsContainer = columnEl ? columnEl.querySelector('.column-cards') : null;
            if (!cardsContainer) return;
            const cardElements = cardsContainer.querySelectorAll('.card');
            const hasFilters = keyword || startDate || endDate || prioFilter || statFilter;
            if (!hasFilters) {
                cardElements.forEach(el => {
                    el.classList.remove('filter-hidden', 'filter-visible');
                    el.classList.add('filter-visible');
                });
                const emptyMsg = cardsContainer.querySelector('.empty-column');
                if (emptyMsg) emptyMsg.style.display = 'none';
                const btn = document.getElementById(`filter-btn-${columnId}`);
                if (btn) btn.classList.remove('active');
                return;
            }
            let visibleCount = 0;
            cardElements.forEach(el => {
                const cardId = parseInt(el.dataset.cardId);
                const card = _cardsMapCache.get(cardId) || state.cards.find(c => c.id === cardId);
                if (!card) { el.classList.add('filter-hidden'); el.classList.remove('filter-visible'); return; }
                let match = true;
                if (keyword) {
                    const searchable = _searchCache.get(cardId) || '';
                    if (!searchable.includes(keyword)) match = false;
                }
                if (match && startDate) {
                    const d = card.startDate || card.deadline;
                    if (!d || d < startDate) match = false;
                }
                if (match && endDate) {
                    const d = card.startDate || card.deadline;
                    if (!d || d > endDate) match = false;
                }
                if (match && prioFilter) {
                    if (card.priority !== prioFilter) match = false;
                }
                if (match && statFilter) {
                    const cardStatus = getDeadlineStatus(card.deadline, card.scheduledTime);
                    if (cardStatus !== statFilter) match = false;
                }
                if (match) {
                    el.classList.remove('filter-hidden', 'filter-visible');
                    el.classList.add('filter-visible');
                    visibleCount++;
                } else {
                    el.classList.remove('filter-visible');
                    el.classList.add('filter-hidden');
                }
            });
            let emptyMsg = cardsContainer.querySelector('.empty-column');
            const totalCards = getCardsForColumnSorted(columnId).length;
            if (visibleCount === 0 && totalCards > 0) {
                if (!emptyMsg) {
                    const msg = document.createElement('div');
                    msg.className = 'empty-column';
                    msg.textContent = 'Aucun résultat';
                    cardsContainer.appendChild(msg);
                } else {
                    emptyMsg.style.display = '';
                    emptyMsg.textContent = 'Aucun résultat';
                }
            } else if (emptyMsg && emptyMsg.textContent === 'Aucun résultat') {
                emptyMsg.style.display = 'none';
            }
            const btn = document.getElementById(`filter-btn-${columnId}`);
            if (btn) btn.classList.toggle('active', hasFilters);
        }
        function applyColumnFilter(columnId) { return applyColumnFilterOptimized(columnId); }
        function clearColumnFilterOptimized(columnId) {
            const searchInput = document.getElementById(`filter-search-${columnId}`);
            const dateStart = document.getElementById(`filter-date-start-${columnId}`);
            const dateEnd = document.getElementById(`filter-date-end-${columnId}`);
            const priority = document.getElementById(`filter-priority-${columnId}`);
            const status = document.getElementById(`filter-status-${columnId}`);
            if (searchInput) searchInput.value = '';
            if (dateStart) dateStart.value = '';
            if (dateEnd) dateEnd.value = '';
            if (priority) priority.value = '';
            if (status) status.value = '';
            delete columnFilterState[columnId];
            const columnEl = document.querySelector(`.column[data-column-id="${columnId}"]`);
            const cardsContainer = columnEl ? columnEl.querySelector('.column-cards') : null;
            if (cardsContainer) {
                cardsContainer.querySelectorAll('.card').forEach(el => {
                    el.classList.remove('filter-hidden', 'filter-visible');
                    el.classList.add('filter-visible');
                });
                const emptyMsg = cardsContainer.querySelector('.empty-column');
                if (emptyMsg && emptyMsg.textContent === 'Aucun résultat') emptyMsg.style.display = 'none';
            }
            const btn = document.getElementById(`filter-btn-${columnId}`);
            if (btn) btn.classList.remove('active');
        }
                function clearColumnFilter(columnId) { return clearColumnFilterOptimized(columnId); }







        // =========== STAT QUICK FILTER ============
        let activeStatFilter = null;

        function toggleStatFilter(filterType) {
            // FIX UX : les filtres rapides n'ont de sens que sur le Tableau ;
            // ils sont désactivés dans les autres onglets (Notes, Calendrier).
            if (typeof currentView !== 'undefined' && currentView !== 'board') return;
            if (activeStatFilter === filterType) {
                activeStatFilter = null;
            } else {
                activeStatFilter = filterType;
            }
            applyStatFilter();
            updateStatFilterUI();
        }

                function applyStatFilter() {
            const statBoard = document.getElementById('board');
            if (statBoard) statBoard.classList.toggle('stat-filter-active', !!activeStatFilter);

            if (!activeStatFilter) {
                // Restaure virtualisation: remet les compteurs à 50 si ils avaient été forcés à 10000
                for (const [colId, count] of _columnVisibleCount.entries()) {
                    if (count > 500) _columnVisibleCount.set(colId, MAX_CARDS_INITIAL);
                }
                document.querySelectorAll('.column').forEach(col => {
                    col.classList.remove('filter-column-hidden');
                    col.classList.add('filter-column-visible');
                    col.querySelectorAll('.card').forEach(card => {
                        card.classList.remove('filter-hidden');
                        card.classList.add('filter-visible');
                    });
                    const emptyMsg = col.querySelector('.empty-column');
                    if (emptyMsg) emptyMsg.style.display = '';
                });
                return;
            }

            const completedCol = findColumnByRole('completed');
            const weekCol = findColumnByRole('week');
            const nextMonthCol = findColumnByRole('next-month');
            const todoCol = findColumnByRole('today');
            const yesterdayCol = findColumnByRole('yesterday');

            // Optimisé: utilise cache pour déterminer quelles colonnes doivent être visibles même si cartes non rendues
            if (_cardsIndexDirty) buildCardsIndex();

            // Précalcule pour chaque colonne si elle contient au moins une carte matching le filtre stat
            const colHasMatch = new Map();
            if (activeStatFilter === 'overdue') {
                for (const [colId, cards] of _cardsByColumnCache.entries()) {
                    let has = false;
                    for (const card of cards) {
                        const col = state.columns.find(c=>c.id===card.columnId);
                        if (!isCompletedColumn(col) && getDeadlineStatus(card.deadline, card.scheduledTime) === 'overdue') { has=true; break; }
                    }
                    colHasMatch.set(colId, has);
                }
            }

            document.querySelectorAll('.column').forEach(col => {
                const colId = parseInt(col.dataset.columnId);
                const cardsInCol = col.querySelectorAll('.card');
                let visibleCount = 0;

                cardsInCol.forEach(cardEl => {
                    const cardId = parseInt(cardEl.dataset.cardId);
                    const card = _cardsMapCache.get(cardId) || state.cards.find(c => c.id === cardId);
                    if (!card) {
                        cardEl.classList.add('filter-hidden');
                        cardEl.classList.remove('filter-visible');
                        return;
                    }

                    let show = false;
                    if (activeStatFilter === 'completed') {
                        show = completedCol && card.columnId === completedCol.id;
                    } else if (activeStatFilter === 'week') {
                        show = weekCol && card.columnId === weekCol.id;
                    } else if (activeStatFilter === 'next-month') {
                        show = nextMonthCol && card.columnId === nextMonthCol.id;
                    } else if (activeStatFilter === 'yesterday') {
                        show = yesterdayCol && card.columnId === yesterdayCol.id;
                    } else if (activeStatFilter === 'progress') {
                        show = weekCol && card.columnId === weekCol.id;
                    } else if (activeStatFilter === 'todo') {
                        show = todoCol && card.columnId === todoCol.id;
                    } else if (activeStatFilter === 'overdue') {
                        const deadlineCol = state.columns.find(c => c.id === card.columnId);
                        if (!isCompletedColumn(deadlineCol)) {
                            show = getDeadlineStatus(card.deadline, card.scheduledTime) === 'overdue';
                        }
                    }

                    if (show) {
                        cardEl.classList.remove('filter-hidden', 'filter-visible');
                        cardEl.classList.add('filter-visible');
                        visibleCount++;
                    } else {
                        cardEl.classList.remove('filter-visible');
                        cardEl.classList.add('filter-hidden');
                    }
                });

                const shouldShow = (
                    (activeStatFilter === 'overdue' && (visibleCount > 0 || colHasMatch.get(colId))) ||
                    (activeStatFilter === 'completed' && completedCol && colId === completedCol.id) ||
                    (activeStatFilter === 'week' && weekCol && colId === weekCol.id) ||
                    (activeStatFilter === 'next-month' && nextMonthCol && colId === nextMonthCol.id) ||
                    (activeStatFilter === 'progress' && weekCol && colId === weekCol.id) ||
                    (activeStatFilter === 'yesterday' && yesterdayCol && colId === yesterdayCol.id) ||
                    (activeStatFilter === 'todo' && todoCol && colId === todoCol.id)
                );

                if (shouldShow) {
                    col.classList.remove('filter-column-hidden');
                    col.classList.add('filter-column-visible');
                    // Si overdue et visibleCount==0 mais colHasMatch vrai (cartes non rendues), on force le chargement complet de la colonne
                    if (activeStatFilter === 'overdue' && visibleCount === 0 && colHasMatch.get(colId)) {
                        // Charge tout pour montrer les résultats
                        _columnVisibleCount.set(colId, 10000);
                        const column = state.columns.find(c=>c.id===colId);
                        if (column) {
                            const board = document.getElementById('board');
                            const oldEl = board.querySelector(`.column[data-column-id="${colId}"]`);
                            if (oldEl) {
                                const newEl = createColumnElement(column);
                                board.replaceChild(newEl, oldEl);
                                initSortableForColumn(colId);
                                // Re-apply filter after full load
                                setTimeout(()=>applyStatFilter(), 0);
                            }
                        }
                    }
                } else {
                    col.classList.remove('filter-column-visible');
                    col.classList.add('filter-column-hidden');
                }

                const emptyMsg = col.querySelector('.empty-column');
                if (emptyMsg) {
                    const origCardCount = (_cardsByColumnCache.get(colId) || []).length;
                    if (visibleCount === 0 && origCardCount > 0) {
                        emptyMsg.style.display = '';
                        emptyMsg.textContent = 'Aucun résultat';
                    } else if (emptyMsg.textContent === 'Aucun résultat') {
                        emptyMsg.style.display = 'none';
                    }
                }
            });
        }



        function updateStatFilterUI() {
            document.querySelectorAll('.stat-item').forEach(el => el.classList.remove('stat-active'));
            if (activeStatFilter) {
                const el = document.querySelector(`[data-stat-type="${activeStatFilter}"]`);
                if (el) el.classList.add('stat-active');
            }
        }

        /* FIX UX : rend les filtres rapides non cliquables hors vue Tableau.
           Appelé à chaque changement d'onglet (voir switchView). */
        function refreshStatsBarState() {
            const bar = document.querySelector('.stats-bar');
            if (!bar) return;
            const disabled = (typeof currentView !== 'undefined') && currentView !== 'board';
            bar.classList.toggle('stats-disabled', disabled);
            bar.querySelectorAll('.stat-item').forEach(btn => { btn.disabled = disabled; });
        }

        // =========== EVENT LISTENERS ============
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('card-menu');
            if (menu && !menu.contains(e.target) && !e.target.closest('.card-menu-btn')) {
                closeCardMenu();
            }
        });

        // =========== POP-UP QR CODE (copyright) ============
        function openQRPopup() {
            const popup = document.getElementById('qr-popup');
            if (!popup) return;
            popup.classList.add('open');
        }
        function closeQRPopup() {
            const popup = document.getElementById('qr-popup');
            if (!popup) return;
            popup.classList.remove('open');
        }
        // Fermeture au clic sur l'arrière-plan
        document.addEventListener('DOMContentLoaded', () => {
            const popup = document.getElementById('qr-popup');
            if (popup) {
                popup.addEventListener('click', (e) => {
                    if (e.target === popup) closeQRPopup();
                });
            }
            const dayOverlay = document.getElementById('day-container');
            if (dayOverlay) {
                dayOverlay.addEventListener('click', (e) => {
                    if (e.target === dayOverlay) closeDaySummary();
                });
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { closeQRPopup(); closeModal(); closeDaySummary(); closeCardMenu(); }
            // Keyboard shortcuts — only when not typing in an input
            const tag = (e.target || {}).tagName;
            const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target || {}).isContentEditable;
            if (isInput) return;
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                showAddCardModalToFirstColumn('quick');
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                exportCSV();
            }
            if (e.key === '?' || (e.shiftKey && e.key === '/')) {
                showToast('Raccourcis : Ctrl+N = Nouvelle tache | Ctrl+E = Export | Echap = Fermer');
            }
        });

        window.addEventListener('beforeunload', () => {
            syncRunningTimers();
            saveState();
        });

        (function enableBoardHorizontalScroll() {
            function onWheel(e) {
                const boardContainer = e.currentTarget;
                if (!boardContainer) return;

                const cardsEl = e.target.closest('.column-cards');
                if (cardsEl && !e.shiftKey && Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
                    const canScrollUp = cardsEl.scrollTop > 0;
                    const canScrollDown = cardsEl.scrollTop + cardsEl.clientHeight < cardsEl.scrollHeight - 1;
                    if ((e.deltaY < 0 && canScrollUp) || (e.deltaY > 0 && canScrollDown)) {
                        return;
                    }
                }

                const maxScroll = boardContainer.scrollWidth - boardContainer.clientWidth;
                if (maxScroll <= 0) return;

                let dx = 0;
                if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                    dx = e.deltaX;
                } else if (e.shiftKey || !cardsEl) {
                    dx = e.deltaY;
                } else {
                    return;
                }

                if (!dx) return;
                const prev = boardContainer.scrollLeft;
                boardContainer.scrollLeft = Math.max(0, Math.min(maxScroll, prev + dx));
                if (boardContainer.scrollLeft !== prev) {
                    e.preventDefault();
                }
            }

            function bind() {
                const el = document.querySelector('.board-container');
                if (!el || el.dataset.hScrollBound === '1') return;
                el.addEventListener('wheel', onWheel, { passive: false });
                el.dataset.hScrollBound = '1';
            }

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', bind);
            } else {
                bind();
            }
            window.addEventListener('load', bind);
        })();

        // =========== STAT ANIMATION ============
        function animateStatNumber(elementId, newValue) {
            const el = document.getElementById(elementId);
            if (!el) return;
            const currentValue = parseInt(el.textContent) || 0;
            if (currentValue === newValue) return;

            // Pop animation
            el.textContent = newValue;
            el.classList.remove('count-pop');
            el.classList.add('count-pop');
            el.addEventListener('animationend', () => el.classList.remove('count-pop'), { once: true });
        }

        function animateStatsEntrance() {
            document.querySelectorAll('.stat-item').forEach((el, i) => {
                el.classList.add('stat-enter');
                el.style.setProperty('--stat-stagger-delay', `${i * 80 + 100}ms`);
            });
        }


        /* ============================================================
           FAB RADIAL — logique d'ouverture / fermeture / raccourcis
           ============================================================ */
        let fabOpen = false;
        function toggleFab(force) {
            const root = document.getElementById('fab-root');
            const backdrop = document.getElementById('fab-backdrop');
            if (!root) return;
            fabOpen = (typeof force === 'boolean') ? force : !fabOpen;
            root.classList.toggle('open', fabOpen);
            if (backdrop) backdrop.classList.toggle('visible', fabOpen);
            const btn = document.getElementById('fab-main');
            if (btn) btn.setAttribute('aria-expanded', fabOpen ? 'true' : 'false');
            if (fabOpen) {
                const tip = document.getElementById('fab-tooltip');
                if (tip) tip.classList.remove('show');
                try { localStorage.setItem('vn-fab-seen', '1'); } catch(e){}
            }
        }
        function showScheduledTaskModal() {
            showAddCardModalToFirstColumn('scheduled');
        }
        function showRecurringTaskModal() {
            showAddCardModalToFirstColumn('recurring');
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && fabOpen) {
                // Si une modale/synthèse est ouverte, c'est elle qui gère Échap ; on ferme juste le FAB
                const modalOpen = document.querySelector('.modal-overlay, .qr-popup-overlay.open, .day-notif-overlay.open, .archive-panel.open');
                if (modalOpen) { toggleFab(false); return; }
                toggleFab(false);
                e.stopPropagation();
                return;
            }
            const tag = (e.target||{}).tagName;
            const isInput = tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||(e.target||{}).isContentEditable;
            if (isInput) return;
            if ((e.key==='c'||e.key==='C') && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                toggleFab();
            }
        }, true);
        document.addEventListener('DOMContentLoaded', () => {
            const tip = document.getElementById('fab-tooltip');
            if (!tip) return;
            let seen = false;
            try { seen = localStorage.getItem('vn-fab-seen') === '1'; } catch(e){}
            if (!seen) {
                setTimeout(()=> { if (!fabOpen) tip.classList.add('show'); setTimeout(()=> tip.classList.remove('show'), 6000); }, 1200);
            }
        });

        // =========== HEADER LIVE CLOCK ============
        function updateHeaderClock() {
            const clockText = document.getElementById('header-clock-time');
            const hourHand = document.getElementById('header-clock-hour');
            const minuteHand = document.getElementById('header-clock-minute');
            if (!clockText || !hourHand || !minuteHand) return;
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();
            const seconds = now.getSeconds();
            const period = hours >= 12 ? 'PM' : 'AM';
            const hour12 = hours % 12 || 12;
            clockText.textContent = `${String(hour12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
            clockText.dateTime = now.toISOString();
            hourHand.setAttribute('transform', `rotate(${(hours % 12) * 30 + minutes * 0.5} 12 12)`);
            minuteHand.setAttribute('transform', `rotate(${minutes * 6 + seconds * 0.1} 12 12)`);
        }


        /* ============================================================
           NOTES — Logique Notion-like (synchronisée en temps réel)
           Stockage: state.notes (dans kanban-data.json) + localStorage
           Synchronisation: même canal que les tâches (saveState / VN Live Sync)
           ============================================================ */
        let currentNoteId = null;
        let notesSearchQuery = '';
        let notesSortable = null;
        let slashMenuEl = null;
        let slashMenuBlockId = null;
        let lastFocusedBlockId = null;
        let _notesSaveDebounce = null;
        let _notesIconPickerOpen = false;
        const NOTE_COVERS = [
            'linear-gradient(135deg, #5856D6 0%, #0071E3 50%, #00C7BE 100%)',
            'linear-gradient(135deg, #FF3B30 0%, #FF9500 50%, #FFCC00 100%)',
            'linear-gradient(135deg, #34C759 0%, #00C7BE 50%, #30B0C7 100%)',
            'linear-gradient(135deg, #AF52DE 0%, #FF2D55 50%, #FF6482 100%)',
            'linear-gradient(135deg, #1D1D1F 0%, #3A3A3C 100%)',
            'linear-gradient(135deg, #F5F5F7 0%, #E5E5EA 100%)',
            'linear-gradient(135deg, #0A84FF 0%, #5856D6 100%)',
            'linear-gradient(135deg, #FFD60A 0%, #FF9500 100%)',
        ];
        const NOTE_ICONS = ['📝','📚','💡','🎯','📌','🔥','⭐','🚀','🎨','📅','✅','💼','🧠','📖','🗒️','📌','🌟','⚡','🎁','🏆','💬','🔍','📊','🛠️','🎵','🌈','🍀','💎','🧩','📍','🗂️','✨','🪄','🌿','☀️','🌙','❤️','👑','🎬','✈️'];
        const BLOCK_TYPES = [
            { type:'paragraph', label:'Texte', desc:'Paragraphe simple', icon:'¶', shortcut:'/' },
            { type:'h1', label:'Titre 1', desc:'Grand titre', icon:'H1', shortcut:'# ' },
            { type:'h2', label:'Titre 2', desc:'Titre moyen', icon:'H2', shortcut:'## ' },
            { type:'h3', label:'Titre 3', desc:'Petit titre', icon:'H3', shortcut:'### ' },
            { type:'todo', label:'À faire', desc:'Case à cocher', icon:'☐', shortcut:'[]' },
            { type:'bullet', label:'Liste à puces', desc:'Liste non ordonnée', icon:'•', shortcut:'- ' },
            { type:'numbered', label:'Liste numérotée', desc:'Liste ordonnée', icon:'1.', shortcut:'1. ' },
            { type:'quote', label:'Citation', desc:'Bloc citation', icon:'❝', shortcut:'> ' },
            { type:'callout', label:'Encadré', desc:'Note mise en avant', icon:'💡', shortcut:'! ' },
            { type:'task', label:'Tâche liée', desc:'Intégrer une tâche Kanban', icon:'📌', shortcut:'@' },
            { type:'code', label:'Code', desc:'Bloc de code', icon:'</>', shortcut:'```' },
            { type:'divider', label:'Séparateur', desc:'Ligne horizontale', icon:'—', shortcut:'---' },
        ];
        function generateNoteId() {
            const used = new Set((state.notes || []).map(x => Number(x.id)));
            const compteur = Number(state.nextNoteId) || 1;
            const plancher = Math.max(compteur, ...(used.size ? [...used] : [0])) + 1;
            let id = plancher + Math.floor(Math.random() * 97);
            while (used.has(id)) id++;
            state.nextNoteId = id + 1;
            return id;
        }
        function generateBlockId() { return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
        function sanitizeNote(raw) {
            const n = (raw && typeof raw === 'object') ? raw : {};
            let id = Number(n.id);
            if (!Number.isFinite(id) || id <= 0) id = generateNoteId();
            const title = typeof n.title === 'string' ? n.title : 'Sans titre';
            const icon = typeof n.icon === 'string' && n.icon ? n.icon : '📝';
            const cover = typeof n.cover === 'string' ? n.cover : NOTE_COVERS[0];
            const hasCover = n.hasCover !== false;
            const parentId = n.parentId != null && Number.isFinite(Number(n.parentId)) ? Number(n.parentId) : null;
            const isFavorite = !!n.isFavorite;
            const isArchived = !!n.isArchived;
            const createdAt = typeof n.createdAt === 'string' ? n.createdAt : new Date().toISOString();
            const updatedAt = typeof n.updatedAt === 'string' ? n.updatedAt : createdAt;
            const order = Number.isFinite(Number(n.order)) ? Number(n.order) : null;
            let blocks = Array.isArray(n.blocks) ? n.blocks : [];
            blocks = blocks.map(b => sanitizeBlock(b)).filter(Boolean);
            if (blocks.length === 0) blocks = [createBlockData('paragraph', '')];
            const out = { id, title, icon, cover, hasCover, parentId, isFavorite, isArchived, createdAt, updatedAt, blocks };
            if (order != null) out.order = order;
            return out;
        }
        function sanitizeBlock(raw) {
            if (!raw || typeof raw !== 'object') return null;
            const type = BLOCK_TYPES.some(x=>x.type===raw.type) ? raw.type : 'paragraph';
            const id = typeof raw.id === 'string' && raw.id ? raw.id : generateBlockId();
            const content = typeof raw.content === 'string' ? raw.content : (raw.text || '');
            const checked = !!raw.checked;
            const language = typeof raw.language === 'string' ? raw.language : 'txt';
            const cardId = raw.cardId != null && Number.isFinite(Number(raw.cardId)) ? Number(raw.cardId) : null;
            const taskMeta = raw.taskMeta && typeof raw.taskMeta === 'object' ? raw.taskMeta : null;
            const out = { id, type, content, checked, language };
            if (cardId != null) out.cardId = cardId;
            if (taskMeta) out.taskMeta = taskMeta;
            return out;
        }
        function createBlockData(type, content, extra={}) {
            const base = { id: generateBlockId(), type: type || 'paragraph', content: content || '', checked: false, language: 'txt' };
            if (extra.cardId != null) base.cardId = extra.cardId;
            if (extra.taskMeta) base.taskMeta = extra.taskMeta;
            return base;
        }
        function ensureNotesState() {
            if (!Array.isArray(state.notes)) state.notes = [];
            if (!Number.isFinite(Number(state.nextNoteId))) {
                const max = state.notes.reduce((m,n)=>Math.max(m, Number(n.id)||0), 0);
                state.nextNoteId = Math.max(1, max+1);
            }
            // Only sanitize if notes look unsanitized (e.g., first note missing blocks or id not number)
            const needsSanitize = state.notes.length > 0 && (
                typeof state.notes[0].id !== 'number' ||
                !Array.isArray(state.notes[0].blocks) ||
                (state.notes[0].blocks.length > 0 && typeof state.notes[0].blocks[0].id !== 'string')
            );
            if (needsSanitize) {
                const seen = new Set();
                state.notes = state.notes.map(r => {
                    const s = sanitizeNote(r);
                    let orig = s.id;
                    while (seen.has(s.id)) s.id = generateNoteId();
                    seen.add(s.id);
                    if (orig !== s.id) console.warn('Note id dupliqué réparé:', orig, '->', s.id);
                    return s;
                });
            }
            // Fix nextNoteId
            const maxId = state.notes.reduce((m,n)=>Math.max(m, n.id), 0);
            if (state.nextNoteId <= maxId) state.nextNoteId = maxId + 1;
            // Ordre manuel : si des notes ont un champ order, on trie par order, sinon par updatedAt
            const hasOrder = state.notes.length>0 && state.notes.every(n=> Number.isFinite(Number(n.order)));
            if (hasOrder) {
                state.notes.sort((a,b)=> Number(a.order)-Number(b.order));
            } else if (state.notes.some(n=> n.order!=null)) {
                // Mixte : celles avec order en premier, puis les autres par updatedAt
                state.notes.sort((a,b)=>{
                    const ao = a.order, bo = b.order;
                    const aHas = Number.isFinite(Number(ao)), bHas = Number.isFinite(Number(bo));
                    if (aHas && bHas) return Number(ao)-Number(bo);
                    if (aHas) return -1;
                    if (bHas) return 1;
                    return new Date(b.updatedAt) - new Date(a.updatedAt);
                });
                // Normalise les order manquants
                let maxO = Math.max(-1, ...state.notes.filter(n=> Number.isFinite(Number(n.order))).map(n=>Number(n.order)));
                state.notes.forEach(n=>{ if(!Number.isFinite(Number(n.order))) n.order = ++maxO; });
                state.notes.sort((a,b)=> Number(a.order)-Number(b.order));
            } else {
                // Aucune note n'a d'ordre -> premier tri par updatedAt puis assigne un order séquentiel
                state.notes.sort((a,b)=> new Date(b.updatedAt) - new Date(a.updatedAt));
                state.notes.forEach((n,i)=> n.order = i);
            }
        }

        // Override sanitizeState to include notes
        (function patchSanitize(){
            const _origSanitize = window.sanitizeState;
            window.sanitizeState = function(raw) {
                const base = _origSanitize ? _origSanitize(raw) : raw;
                if (!base) return base;
                if (!Array.isArray(base.notes)) {
                    if (Array.isArray(raw.notes)) base.notes = raw.notes;
                    else base.notes = [];
                }
                if (!Number.isFinite(Number(base.nextNoteId))) {
                    base.nextNoteId = 1;
                }
                // Sanitize notes
                const seen = new Set();
                // ensure base.notes is array
                base.notes = (base.notes || []).map(r => {
                    try { return sanitizeNote(r); } catch(e){ console.warn('sanitizeNote failed', e); return null; }
                }).filter(Boolean);
                // deduplicate ids
                const deduped = [];
                const used = new Set();
                base.notes.forEach(n=>{
                    let id = n.id;
                    while (used.has(id)) id = 1 + Math.max(...Array.from(used), 0) + Math.floor(Math.random()*100);
                    n.id = id;
                    used.add(id);
                    deduped.push(n);
                });
                base.notes = deduped;
                const maxNote = base.notes.reduce((m,n)=>Math.max(m, n.id), 0);
                base.nextNoteId = Math.max(Number(base.nextNoteId)||1, maxNote+1);
                // Tri par order si disponible, sinon par updatedAt puis assigne order
                const hasO = base.notes.length>0 && base.notes.every(n=> Number.isFinite(Number(n.order)));
                if (hasO) base.notes.sort((a,b)=> Number(a.order)-Number(b.order));
                else if (base.notes.some(n=> n.order!=null)) {
                    base.notes.sort((a,b)=>{
                        const ao=a.order, bo=b.order; const aHas=Number.isFinite(Number(ao)), bHas=Number.isFinite(Number(bo));
                        if(aHas&&bHas) return Number(ao)-Number(bo); if(aHas) return -1; if(bHas) return 1; return new Date(b.updatedAt)-new Date(a.updatedAt);
                    });
                    let maxO = Math.max(-1, ...base.notes.filter(n=> Number.isFinite(Number(n.order))).map(n=>Number(n.order)));
                    base.notes.forEach(n=>{ if(!Number.isFinite(Number(n.order))) n.order = ++maxO; });
                    base.notes.sort((a,b)=> Number(a.order)-Number(b.order));
                } else {
                    base.notes.sort((a,b)=> new Date(b.updatedAt) - new Date(a.updatedAt));
                    base.notes.forEach((n,i)=> n.order=i);
                }
                return base;
            };
        })();

        // Override migrateData to handle v7 -> v8
        (function patchMigrate(){
            const _origMigrate = window.migrateData;
            window.migrateData = function(oldData) {
                let base = _origMigrate ? _origMigrate(oldData) : oldData;
                if (!base) base = oldData;
                // Ensure notes fields exist (v7 -> v8)
                if (!Array.isArray(base.notes)) base.notes = [];
                if (!Number.isFinite(Number(base.nextNoteId))) base.nextNoteId = 1;
                // If old data had version 7, create a welcome note
                if (!oldData.notes && (!oldData.version || oldData.version < 8)) {
                    if (base.notes.length === 0) {
                        base.notes = [sanitizeNote({
                            id: 1,
                            title: 'Bienvenue dans tes notes ✨',
                            icon: '👋',
                            cover: NOTE_COVERS[0],
                            hasCover: true,
                            parentId: null,
                            isFavorite: true,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                            blocks: [
                                { id: generateBlockId(), type: 'paragraph', content: 'Bienvenue ! Cet espace fonctionne exactement comme Notion : chaque page est un document vivant composé de blocs.', checked: false },
                                { id: generateBlockId(), type: 'callout', content: '💡 Astuce : tape “/” n\'importe où pour changer de type de bloc (titre, liste, code…).', checked: false },
                                { id: generateBlockId(), type: 'h2', content: 'Par où commencer ?', checked: false },
                                { id: generateBlockId(), type: 'todo', content: 'Créer ma première page', checked: false },
                                { id: generateBlockId(), type: 'todo', content: 'Essayer les titres et les listes', checked: false },
                                { id: generateBlockId(), type: 'todo', content: 'Taper “/” pour découvrir les blocs', checked: false },
                                { id: generateBlockId(), type: 'quote', content: 'Tes notes sont synchronisées en temps réel — même technologie que tes tâches, avec le dossier Root et entre tes appareils.', checked: false },
                                { id: generateBlockId(), type: 'divider', content: '', checked: false },
                                { id: generateBlockId(), type: 'paragraph', content: 'Tu peux organiser tes pages, les mettre en favori ⭐, changer leur icône et leur couverture, et tout est sauvegardé automatiquement.', checked: false },
                                { id: generateBlockId(), type: 'code', content: '// Exemple de bloc code\nconsole.log("Hello, VN Notes ✨");', checked: false, language: 'js' },
                            ]
                        })];
                        base.nextNoteId = 2;
                    }
                }
                base.version = 8;
                return base;
            };
        })();

        // Override mergeStates to include notes
        (function patchMerge(){
            const _origMergeStates = window.mergeStates;
            window.mergeStates = function(baseState, ourState, theirState) {
                // Fallback to original if not yet patched
                let result;
                if (_origMergeStates) {
                    // we need to handle notes ourselves, so we call original for cards/columns then merge notes
                    const base = baseState || {};
                    const ours = ourState || {};
                    const theirs = theirState || {};
                    // Use original mergeCollections if available
                    const mergeCollections = window.mergeCollections;
                    if (typeof mergeCollections === 'function') {
                        const cols = mergeCollections(base.columns, ours.columns, theirs.columns);
                        const cards = mergeCollections(base.cards, ours.cards, theirs.cards);
                        const notes = mergeCollections(base.notes || [], ours.notes || [], theirs.notes || []);
                        const fusionne = window.sanitizeState({
                            version: DATA_VERSION,
                            columns: cols.items.length ? cols.items : (theirs.columns || base.columns),
                            cards: cards.items,
                            notes: notes.items,
                            nextCardId: Math.max(ours.nextCardId||1, theirs.nextCardId||1),
                            nextColumnId: Math.max(ours.nextColumnId||1, theirs.nextColumnId||1),
                            nextNoteId: Math.max(ours.nextNoteId||1, theirs.nextNoteId||1),
                            customCategories: ours.customCategories || theirs.customCategories
                        });
                        const stats = {
                            nous: (cards.stats.nous||0)+(cols.stats.nous||0)+(notes.stats.nous||0),
                            eux: (cards.stats.eux||0)+(cols.stats.eux||0)+(notes.stats.eux||0),
                            supprimes: (cards.stats.supprimes||0)+(cols.stats.supprimes||0)+(notes.stats.supprimes||0),
                            conflits: (cards.stats.conflits||0)+(cols.stats.conflits||0)+(notes.stats.conflits||0)
                        };
                        result = { state: fusionne, stats };
                    } else {
                        result = _origMergeStates(baseState, ourState, theirState);
                        // Manually merge notes simple last-write-wins
                        result.state.notes = theirs.notes || ours.notes || [];
                        result.state.nextNoteId = Math.max(ours.nextNoteId||1, theirs.nextNoteId||1);
                    }
                } else {
                    // fallback
                    result = { state: window.sanitizeState(theirState), stats: {} };
                }
                return result;
            };
            // Also patch integrerContenuDisque to trigger notes re-render
            const _origIntegrer = window.integrerContenuDisque;
            if (_origIntegrer) {
                window.integrerContenuDisque = function(texteDisque) {
                    // FIX focus : on ne rafraîchit l'UI des notes que si les notes
                    // ont réellement changé pendant la fusion. Avant, chaque synchro
                    // (même ne touchant que des tâches) re-rendait tout l'éditeur de
                    // notes et détruisait le champ en cours de saisie → perte de focus,
                    // l'utilisateur devait recliquer pour continuer à écrire.
                    const notesAvant = JSON.stringify((state && state.notes) || []);
                    const res = _origIntegrer(texteDisque);
                    // After merge, refresh notes UI if notes view is active or sidebar exists
                    if (res && res.applique) {
                        try { ensureNotesState(); } catch(e){}
                        const notesApres = JSON.stringify((state && state.notes) || []);
                        if (notesAvant !== notesApres) {
                            try {
                                renderNotesSidebar();
                                if (currentNoteId != null) {
                                    const stillExists = state.notes.some(n=>n.id===currentNoteId);
                                    if (stillExists) renderNotesEditor(currentNoteId, false);
                                    else { currentNoteId=null; showNotesEmpty(); }
                                }
                                updateNotesCount();
                            } catch(e){ console.warn('post-merge notes refresh failed', e); }
                        }
                    }
                    return res;
                };
            }
        })();

        // ========== Notes CRUD ==========
        function createNewNote(parentId=null) {
            const now = new Date().toISOString();
            const note = sanitizeNote({
                id: generateNoteId(),
                title: 'Sans titre',
                icon: NOTE_ICONS[Math.floor(Math.random()*NOTE_ICONS.length)],
                cover: NOTE_COVERS[Math.floor(Math.random()*NOTE_COVERS.length)],
                hasCover: true,
                parentId: parentId,
                isFavorite: false,
                isArchived: false,
                createdAt: now,
                updatedAt: now,
                blocks: [createBlockData('paragraph', '')]
            });
            // Place en tête de l'ordre manuel
            const minOrder = state.notes.length ? Math.min(...state.notes.map(n=> Number.isFinite(Number(n.order))?Number(n.order):0)) : 0;
            note.order = minOrder - 1;
            state.notes.unshift(note);
            // Ensure nextNoteId is updated (allocateId already did)
            saveState();
            renderNotesSidebar();
            openNote(note.id);
            showToast('Nouvelle page créée');
            // Focus title after render
            setTimeout(()=> {
                const ti = document.getElementById('notes-title-input');
                if (ti) { ti.focus(); ti.select(); }
            }, 60);
            // Switch to notes view if not already
            if (currentView !== 'notes') switchView('notes');
        }
        function openNote(noteId) {
            const note = state.notes.find(n=>n.id===noteId);
            if (!note) { showToast('Note introuvable'); return; }
            currentNoteId = noteId;
            // Move to top of list by updating updatedAt? Not on open, only on edit
            renderNotesSidebar();
            renderNotesEditor(noteId, true);
            // Update URL hash for sharing? optional
            try { history.replaceState(null, '', '#note-'+noteId); } catch(e){}
            // Close mobile sidebar
            toggleNotesSidebar(false);
        }
        function handleNoteTitleInput(el) {
            const note = state.notes.find(n=>n.id===currentNoteId);
            if (!note) return;
            note.title = el.value;
            note.updatedAt = new Date().toISOString();
            // Auto-resize textarea
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
            renderNotesSidebar();
            updateNotesMeta();
            const bc = document.getElementById('notes-breadcrumb-title');
            if (bc) bc.textContent = note.title || 'Sans titre';
            scheduleNotesSave();
        }
        function handleNoteTitleKeydown(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                // Move focus to first block
                const firstBlock = document.querySelector('#notes-blocks .note-block [contenteditable]');
                if (firstBlock) firstBlock.focus();
            }
        }
        function toggleNoteFavorite(noteId) {
            const target = noteId || currentNoteId;
            const note = state.notes.find(n=>n.id===target);
            if (!note) return;
            note.isFavorite = !note.isFavorite;
            note.updatedAt = new Date().toISOString();
            saveState();
            renderNotesSidebar();
            renderNotesEditor(target, false);
            showToast(note.isFavorite ? 'Ajouté aux favoris ⭐' : 'Retiré des favoris');
        }
        function deleteCurrentNote() {
            if (currentNoteId==null) return;
            const note = state.notes.find(n=>n.id===currentNoteId);
            if (!note) return;
            if (!confirm(`Supprimer “${note.title || 'Sans titre'}” ? Cette action est irréversible.`)) return;
            const idx = state.notes.findIndex(n=>n.id===currentNoteId);
            state.notes.splice(idx,1);
            // Also delete children? For now reparent children to null
            state.notes.forEach(n=>{ if(n.parentId===currentNoteId) n.parentId=null; });
            const deletedId = currentNoteId;
            currentNoteId = null;
            saveState();
            renderNotesSidebar();
            showNotesEmpty();
            showToast('Page supprimée');
            // Also remove hash
            try { history.replaceState(null,'', location.pathname); } catch(e){}
        }
        function duplicateCurrentNote() {
            if (currentNoteId==null) return;
            const orig = state.notes.find(n=>n.id===currentNoteId);
            if (!orig) return;
            const now = new Date().toISOString();
            const copy = JSON.parse(JSON.stringify(orig));
            copy.id = generateNoteId();
            copy.title = orig.title + ' (copie)';
            copy.isFavorite = false;
            copy.createdAt = now;
            copy.updatedAt = now;
            copy.order = (orig.order!=null? Number(orig.order)+0.5 : Date.now());
            // regenerate block ids
            copy.blocks = copy.blocks.map(b=> ({...b, id: generateBlockId()}));
            state.notes.unshift(copy);
            saveState();
            renderNotesSidebar();
            openNote(copy.id);
            showToast('Page dupliquée');
        }
        function createChildNote(parentId) {
            createNewNote(parentId);
        }
        function handleNotesSearch(q) {
            notesSearchQuery = (q||'').toLowerCase().trim();
            renderNotesSidebar();
        }
        function collapseAllNotes() { /* no hierarchy collapse for now */ renderNotesSidebar(); }

        // ========== Blocks ==========
        function addBlockAfter(afterBlockId, type='paragraph', content='') {
            if (currentNoteId==null) return;
            const note = state.notes.find(n=>n.id===currentNoteId);
            if (!note) return;
            const newBlock = createBlockData(type, content);
            const idx = note.blocks.findIndex(b=>b.id===afterBlockId);
            if (idx>=0) note.blocks.splice(idx+1,0,newBlock);
            else note.blocks.push(newBlock);
            note.updatedAt = new Date().toISOString();
            saveState();
            renderNotesBlocks();
            // Focus new block
            setTimeout(()=>{
                const el = document.querySelector(`[data-block-id="${newBlock.id}"] [contenteditable]`);
                if (el) { el.focus(); placeCaretAtEnd(el); }
                renderNotesSidebar();
            }, 30);
            return newBlock;
        }
        function addBlockAtEnd() {
            if (currentNoteId==null) { createNewNote(); return; }
            const note = state.notes.find(n=>n.id===currentNoteId);
            if (!note) return;
            const nb = createBlockData('paragraph','');
            note.blocks.push(nb);
            note.updatedAt = new Date().toISOString();
            saveState();
            renderNotesBlocks();
            setTimeout(()=>{
                const el = document.querySelector(`[data-block-id="${nb.id}"] [contenteditable]`);
                if(el){ el.focus(); }
            },30);
        }
        function showSlashMenuForNewBlock(){ addBlockAtEnd(); setTimeout(()=> showSlashMenu(document.querySelector('#notes-blocks .note-block:last-child')?.dataset.blockId), 50); }
        function deleteBlock(blockId) {
            if (currentNoteId==null) return;
            const note = state.notes.find(n=>n.id===currentNoteId);
            if (!note) return;
            if (note.blocks.length<=1) {
                // Keep at least one empty block
                note.blocks[0].content=''; note.blocks[0].type='paragraph'; note.blocks[0].checked=false;
            } else {
                const idx = note.blocks.findIndex(b=>b.id===blockId);
                if (idx>=0) note.blocks.splice(idx,1);
            }
            note.updatedAt = new Date().toISOString();
            saveState();
            renderNotesBlocks();
            renderNotesSidebar();
        }
        function changeBlockType(blockId, newType) {
            if (currentNoteId==null) return;
            const note = state.notes.find(n=>n.id===currentNoteId);
            const block = note?.blocks.find(b=>b.id===blockId);
            if (!block) return;
            if (newType==='task') {
                // Open task picker to link an existing task or create one
                showTaskPickerForBlock(blockId);
                hideSlashMenu();
                return;
            }
            block.type = newType;
            if (newType==='divider') block.content='';
            if (newType==='todo' && block.checked==null) block.checked=false;
            note.updatedAt = new Date().toISOString();
            saveState();
            renderNotesBlocks();
            // Keep focus
            setTimeout(()=>{
                const el = document.querySelector(`[data-block-id="${blockId}"] [contenteditable]`);
                if(el && newType!=='divider' && newType!=='task') el.focus();
            },30);
            hideSlashMenu();
        }
        function getSelectedBlockIds() {
            const ids = [];
            const sel = window.getSelection();
            const container = document.getElementById('notes-blocks');
            if (!container) return ids;
            // Cas 1: sélection / curseur réellement à l'intérieur des blocs (prioritaire : "seulement ma sélection")
            if (sel && sel.rangeCount > 0) {
                try {
                    const anchorBlock = sel.anchorNode ? sel.anchorNode.parentElement?.closest?.('.note-block') : null;
                    const focusBlock = sel.focusNode ? sel.focusNode.parentElement?.closest?.('.note-block') : null;
                    const anchorInside = anchorBlock && container.contains(anchorBlock);
                    const focusInside = focusBlock && container.contains(focusBlock);
                    if (anchorInside || focusInside) {
                        if (anchorBlock && focusBlock) {
                            if (anchorBlock === focusBlock) {
                                ids.push(anchorBlock.dataset.blockId);
                            } else {
                                const all = Array.from(container.querySelectorAll('.note-block'));
                                const aIdx = all.indexOf(anchorBlock);
                                const fIdx = all.indexOf(focusBlock);
                                if (aIdx !== -1 && fIdx !== -1) {
                                    const start = Math.min(aIdx, fIdx);
                                    const end = Math.max(aIdx, fIdx);
                                    for (let k = start; k <= end; k++) ids.push(all[k].dataset.blockId);
                                } else if (anchorInside) {
                                    ids.push(anchorBlock.dataset.blockId);
                                }
                            }
                        } else if (anchorInside) {
                            ids.push(anchorBlock.dataset.blockId);
                        } else if (focusInside) {
                            ids.push(focusBlock.dataset.blockId);
                        }
                        if (ids.length) return ids;
                    }
                } catch(e) {}
            }
            // Cas 2: focus clavier — activeElement dans un bloc (préservé grâce à onmousedown preventDefault sur la toolbar)
            const activeBlock = document.activeElement ? document.activeElement.closest?.('.note-block') : null;
            if (activeBlock && container.contains(activeBlock)) {
                ids.push(activeBlock.dataset.blockId);
                return ids;
            }
            // Cas 3: fallback sur le bloc visuellement focus (is-focused) — uniquement si ce bloc existe et qu'on est bien en vue notes
            // Cela couvre le cas jsdom/tests où handleBlockFocus a été appelé mais le focus natif a été perdu après un re-render,
            // et le cas toolbar avec preventDefault où activeElement reste brièvement sur le bouton.
            // On NE retombe JAMAIS sur "dernier bloc" (ancien bug).
            const focusedDom = container.querySelector('.note-block.is-focused');
            if (focusedDom) {
                const notesVisible = document.getElementById('notes-container')?.classList.contains('is-visible');
                const activeIsToolbar = document.activeElement?.closest?.('#notes-toolbar');
                // Si la toolbar a le focus (clic toolbar) ou que la note est visible et qu'aucune autre sélection n'existe, on considère le is-focused comme sélection courante
                if (notesVisible && (activeIsToolbar || (typeof lastFocusedBlockId !== 'undefined' && lastFocusedBlockId === focusedDom.dataset.blockId))) {
                    ids.push(focusedDom.dataset.blockId);
                    return ids;
                }
            }
            // Aucune sélection valide dans la note → on ne touche à rien (évite que la dernière ligne change seule)
            return ids;
        }
        function formatBlock(type) {
            // SÉLECTION SEULE : n'impacte QUE les blocs réellement sélectionnés / où se trouve le curseur
            const ids = getSelectedBlockIds();
            if (!ids.length) { showToast('Sélectionne d\'abord un bloc'); return; }
            const note = state.notes.find(n=>n.id===currentNoteId);
            if (!note) return;
            // Si un seul bloc sélectionné et déjà du même type → toggle off vers paragraph (sauf task)
            if (ids.length === 1) {
                const block = note.blocks.find(b=>b.id===ids[0]);
                if (!block) return;
                if (block.type === 'task' && type !== 'task') {
                    showToast('Bloc tâche protégé — supprime-le avec ✕ pour le remplacer');
                    return;
                }
                if (block.type === type && type !== 'task') {
                    changeBlockType(ids[0], 'paragraph');
                    return;
                }
            }
            // Multi-sélection ou type différent : applique à chaque bloc éligible
            // On évite d'écraser les tâches par un autre format en multi-sélection
            const toChange = ids.filter(id => {
                const b = note.blocks.find(x=>x.id===id);
                if (!b) return false;
                if (b.type === 'task' && type !== 'task') return false;
                return b.type !== type; // pas besoin de rechanger si déjà au bon type
            });
            if (!toChange.length) {
                // Tous déjà au bon type en multi → toggle off vers paragraph (sauf task)
                if (type !== 'task') {
                    ids.forEach(id => {
                        const b = note.blocks.find(x=>x.id===id);
                        if (b && b.type === type) changeBlockType(id, 'paragraph');
                    });
                    // Si plusieurs appels à changeBlockType re-rendent, on ne garde que le dernier : on doit batch
                    // Pour multi, on préfère un batch direct :
                    if (ids.length > 1) {
                        // Annule les changements individuels déjà faits et fait un batch propre
                    }
                    return;
                }
                return;
            }
            if (toChange.length === 1) {
                changeBlockType(toChange[0], type);
            } else {
                // Batch multi-blocs : change sans re-render intermédiaire pour éviter perte de sélection
                toChange.forEach(id => {
                    const b = note.blocks.find(x=>x.id===id);
                    if (b) {
                        b.type = type;
                        if (type==='divider') b.content='';
                        if (type==='todo' && b.checked==null) b.checked=false;
                    }
                });
                note.updatedAt = new Date().toISOString();
                saveState();
                renderNotesBlocks();
                hideSlashMenu();
                // Restaure sélection visuelle sur le premier bloc
                const firstEl = document.querySelector(`[data-block-id="${toChange[0]}"] [contenteditable]`);
                if (firstEl) try{ firstEl.focus(); }catch(e){}
            }
        }
        function toggleTodoBlock(blockId) {
            // Try current note first, then search all notes (robust for tests)
            let note = currentNoteId != null ? state.notes.find(n=>n.id===currentNoteId) : null;
            let block = note?.blocks.find(b=>b.id===blockId);
            if (!block) {
                // Search all notes for the block (fallback)
                for (const n of (state.notes||[])) {
                    const b = n.blocks.find(x=>x.id===blockId);
                    if (b) { note = n; block = b; break; }
                }
            }
            if (!note || !block) return;
            block.checked = !block.checked;
            note.updatedAt = new Date().toISOString();
            saveState();
            // Update only this block's UI without full re-render to keep focus
            const blockEl = document.querySelector(`[data-block-id="${blockId}"]`);
            if (blockEl) {
                const chk = blockEl.querySelector('.todo-check');
                const editable = blockEl.querySelector('[contenteditable]');
                if (chk) chk.classList.toggle('checked', block.checked);
                if (chk) chk.innerHTML = block.checked ? '✓' : '';
                if (editable) editable.classList.toggle('checked', block.checked);
            }
            updateNotesMeta();
            renderNotesSidebar();
        }
        function handleBlockInput(blockId, el) {
            if (currentNoteId==null) return;
            const note = state.notes.find(n=>n.id===currentNoteId);
            const block = note?.blocks.find(b=>b.id===blockId);
            if (!block) return;
            // Get text content (innerText to preserve line breaks)
            let content = el.innerText;
            // Code blocks need raw text
            if (block.type==='code') content = el.textContent;
            block.content = content;
            note.updatedAt = new Date().toISOString();
            // Check for markdown shortcuts at start
            const trimmed = content.trimStart();
            // Slash menu trigger
            if (content.startsWith('/') && content.length<=20 && !content.includes(' ')) {
                showSlashMenu(blockId);
            } else {
                hideSlashMenu();
            }
            // Auto-transform shortcuts on space
            if (content.endsWith(' ')) {
                const before = content.slice(0,-1).trim();
                if (before === '#') changeBlockType(blockId,'h1');
                else if (before === '##') changeBlockType(blockId,'h2');
                else if (before === '###') changeBlockType(blockId,'h3');
                else if (before === '-' || before === '*') changeBlockType(blockId,'bullet');
                else if (/^\d+\.$/.test(before)) changeBlockType(blockId,'numbered');
                else if (before === '[]') changeBlockType(blockId,'todo');
                else if (before === '@') changeBlockType(blockId,'task');
                else if (before === '>') changeBlockType(blockId,'quote');
                else if (before === '---') changeBlockType(blockId,'divider');
                else if (before === '```') changeBlockType(blockId,'code');
            }
            updateNotesMeta();
            scheduleNotesSave();
            renderNotesSidebar(); // update preview
        }
        function handleBlockKeydown(blockId, e) {
            const el = e.target;
            if (e.key === 'Enter' && !e.shiftKey) {
                // For code block, allow newline with enter? But we keep simple: Enter creates new block
                if (el.closest('.note-block')?.dataset.type === 'code' && e.shiftKey) return;
                e.preventDefault();
                // If slash menu open, select first
                if (slashMenuEl && slashMenuBlockId===blockId) {
                    const first = slashMenuEl.querySelector('.slash-item');
                    if (first) { first.click(); return; }
                }
                // For h1/h2/h3, create paragraph after
                const note = state.notes.find(n=>n.id===currentNoteId);
                const block = note?.blocks.find(b=>b.id===blockId);
                const curType = block?.type;
                // If empty todo/bullet etc and enter, convert to paragraph instead of adding new?
                if ((curType==='todo' || curType==='bullet' || curType==='numbered') && !block.content.trim()) {
                    changeBlockType(blockId,'paragraph');
                    return;
                }
                const nb = addBlockAfter(blockId, 'paragraph', '');
                // If we were at end of a heading, move cursor to new block
            } else if (e.key === 'Backspace' && el.innerText === '') {
                // Delete empty block (but keep at least one)
                const note = state.notes.find(n=>n.id===currentNoteId);
                if (note && note.blocks.length>1) {
                    e.preventDefault();
                    const idx = note.blocks.findIndex(b=>b.id===blockId);
                    deleteBlock(blockId);
                    // Focus previous
                    setTimeout(()=>{
                        const prevId = note.blocks[Math.max(0, idx-1)]?.id;
                        const prevEl = prevId ? document.querySelector(`[data-block-id="${prevId}"] [contenteditable]`) : null;
                        if (prevEl) { prevEl.focus(); placeCaretAtEnd(prevEl); }
                    },30);
                }
            } else if (e.key === 'ArrowUp' && isCaretAtStart(el)) {
                e.preventDefault();
                focusAdjacentBlock(blockId, -1);
            } else if (e.key === 'ArrowDown' && isCaretAtEnd(el)) {
                e.preventDefault();
                focusAdjacentBlock(blockId, 1);
            } else if (e.key === '/' && el.innerText === '') {
                // will trigger slash on input
            } else if (e.key === 'Escape') {
                hideSlashMenu();
                hideIconPicker();
            }
        }
        function handleBlockPaste(blockId, e) {
            // Plain text paste
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text/plain');
            document.execCommand('insertText', false, text);
        }
        function focusAdjacentBlock(currentBlockId, delta) {
            const note = state.notes.find(n=>n.id===currentNoteId);
            if (!note) return;
            const idx = note.blocks.findIndex(b=>b.id===currentBlockId);
            const target = note.blocks[idx+delta];
            if (target) {
                const el = document.querySelector(`[data-block-id="${target.id}"] [contenteditable]`);
                if (el) { el.focus(); placeCaretAtEnd(el); }
            }
        }
        function isCaretAtStart(el) {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount===0) return false;
            const range = sel.getRangeAt(0);
            // Check if at start
            const pre = range.cloneRange();
            pre.selectNodeContents(el);
            pre.setEnd(range.startContainer, range.startOffset);
            return pre.toString() === '';
        }
        function isCaretAtEnd(el) {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount===0) return false;
            const range = sel.getRangeAt(0);
            const post = range.cloneRange();
            post.selectNodeContents(el);
            post.setStart(range.endContainer, range.endOffset);
            return post.toString() === '';
        }
        function placeCaretAtEnd(el) {
            el.focus();
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            const sel = window.getSelection();
            if (sel) { sel.removeAllRanges(); sel.addRange(range); }
        }
        function scheduleNotesSave() {
            if (_notesSaveDebounce) clearTimeout(_notesSaveDebounce);
            const badge = document.getElementById('notes-sync-badge');
            if (badge) { badge.classList.add('syncing'); badge.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M21 12a9 9 0 11-6.2-8.6"/><path d="M21 12a9 9 0 01-9 9"/></svg> Enregistrement…'; }
            _notesSaveDebounce = setTimeout(()=>{
                saveState();
                if (badge) { badge.classList.remove('syncing'); badge.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg> Synchronisé'; setTimeout(()=> { badge.style.opacity='0.7'; }, 1200); }
                showToast('Note synchronisée ✓', 1200);
            }, 700);
        }

        // ========== Rendering ==========
        function updateNotesCount() {
            const badge = document.getElementById('notes-count-badge');
            if (badge) badge.textContent = state.notes.length;
        }
        function renderNotesSidebar() {
            if (!Array.isArray(state.notes)) state.notes = [];
            if (!Array.isArray(state.notes)) state.notes = [];
            updateNotesCount();
            const listEl = document.getElementById('notes-list');
            const favEl = document.getElementById('notes-fav-list');
            const favSection = document.getElementById('notes-fav-section');
            const emptyEl = document.getElementById('notes-sidebar-empty');
            if (!listEl) return;
            let filtered = state.notes;
            if (notesSearchQuery) {
                filtered = filtered.filter(n=>{
                    const hay = (n.title + ' ' + n.blocks.map(b=>b.content).join(' ') + ' ' + n.icon).toLowerCase();
                    return hay.includes(notesSearchQuery);
                });
            }
            // Favorites (tri par order)
            const favs = filtered.filter(n=>n.isFavorite).sort((a,b)=>{
                const ao=a.order, bo=b.order; const aHas=Number.isFinite(Number(ao)), bHas=Number.isFinite(Number(bo));
                if(aHas&&bHas) return Number(ao)-Number(bo);
                if(aHas) return -1; if(bHas) return 1; return new Date(b.updatedAt)-new Date(a.updatedAt);
            });
            if (favEl && favSection) {
                if (favs.length>0) {
                    favSection.style.display='block';
                    favEl.innerHTML = favs.map(n=> renderNoteItemHTML(n, true)).join('');
                } else {
                    // Garde la section visible comme zone de dépôt même vide (facilite le glisser vers favoris)
                    favSection.style.display='block';
                    favEl.innerHTML = '<div class="notes-fav-empty" style="border:1.5px dashed var(--line); border-radius:10px; padding:14px 10px; text-align:center; color:var(--muted); font-size:12px; background:var(--bg-soft);">Glisser une note ici pour l’ajouter aux favoris ⭐</div>';
                }
            }
            const nonFavOrAll = notesSearchQuery ? filtered : filtered.filter(n=>!n.isFavorite);
            // Also show favs in main list when searching? Already included via filtered; to avoid dup when not searching, exclude favs
            const toShow = filtered; // show all in main, but highlight favs
            // Actually for non-search, show all sorted, favs already in fav section but also in main? Better show only non-favs in main to avoid dup
            const mainList = notesSearchQuery ? filtered : filtered;
            // If searching, show filtered in main only
            // To avoid duplication in non-search mode, we will show all notes in main, but favs are duplicated? Design: keep duplication simple: main shows all
            if (mainList.length===0) {
                listEl.innerHTML='';
                if (emptyEl) emptyEl.style.display='block';
            } else {
                if (emptyEl) emptyEl.style.display='none';
                // Group by parent? For now flat sorted by updatedAt
                // But handle nesting: children after parent
                const sorted = [...mainList].sort((a,b)=>{
                    const ao=a.order, bo=b.order; const aHas=Number.isFinite(Number(ao)), bHas=Number.isFinite(Number(bo));
                    if(aHas&&bHas) return Number(ao)-Number(bo);
                    if(aHas) return -1;
                    if(bHas) return 1;
                    return new Date(b.updatedAt)-new Date(a.updatedAt);
                });
                // Build hierarchy: parents first, then children indented
                const byParent = new Map();
                sorted.forEach(n=>{
                    const pid = n.parentId || 'root';
                    if (!byParent.has(pid)) byParent.set(pid, []);
                    byParent.get(pid).push(n);
                });
                let html = '';
                // simple flat with nested indication
                sorted.forEach(n=>{
                    html += renderNoteItemHTML(n, false);
                });
                listEl.innerHTML = html;
            }
            // Mark active
            document.querySelectorAll('.note-item').forEach(el=>{
                const id = Number(el.dataset.noteId);
                el.classList.toggle('active', id===currentNoteId);
            });
            initNotesSidebarSortable();
        }
        let notesSidebarSortable = null;
        let notesFavSortable = null;
        function initNotesSidebarSortable() {
            const listEl = document.getElementById('notes-list');
            const favEl = document.getElementById('notes-fav-list');
            if (typeof Sortable === 'undefined') return;
            if (notesSearchQuery) return; // désactive le drag pendant la recherche
            const commonOpts = {
                group: { name: 'notes-sidebar', pull: true, put: true },
                draggable: '.note-item',
                // Même UX que les tâches Journée : toute la ligne est draggable
                // Un court délai distingue le clic (ouvre la note) du drag
                delay: 40,
                delayOnTouchOnly: false,
                touchStartThreshold: 3,
                animation: 180,
                easing: 'cubic-bezier(0.32,0.72,0,1)',
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                fallbackOnBody: true,
                fallbackTolerance: 3,
                swapThreshold: 0.65,
                filter: '.note-item-actions, .note-item-actions *',
                preventOnFilter: false,
                onStart: function(){
                    document.querySelectorAll('.notes-list').forEach(el=> el.classList.add('notes-drop-target'));
                },
                onEnd: function(){
                    document.querySelectorAll('.notes-list').forEach(el=> el.classList.remove('notes-drop-target'));
                }
            };
            // Main list (PRIVÉ) : ordre global
            if (listEl) {
                if (notesSidebarSortable) { try{ notesSidebarSortable.destroy(); }catch(e){} notesSidebarSortable=null; }
                notesSidebarSortable = new Sortable(listEl, {
                    ...commonOpts,
                    onEnd: function(evt){
                        document.querySelectorAll('.notes-list').forEach(el=> el.classList.remove('notes-drop-target'));
                        handleNotesSidebarDrop(evt, 'main');
                    },
                    onAdd: function(evt){
                        document.querySelectorAll('.notes-list').forEach(el=> el.classList.remove('notes-drop-target'));
                        handleNotesSidebarDrop(evt, 'main');
                    }
                });
            }
            // Favoris : réordonne uniquement les favoris + déplacement depuis privé = ajoute aux favoris
            if (favEl) {
                if (notesFavSortable) { try{ notesFavSortable.destroy(); }catch(e){} notesFavSortable=null; }
                notesFavSortable = new Sortable(favEl, {
                    ...commonOpts,
                    onEnd: function(evt){
                        document.querySelectorAll('.notes-list').forEach(el=> el.classList.remove('notes-drop-target'));
                        handleNotesSidebarDrop(evt, 'fav');
                    },
                    onAdd: function(evt){
                        document.querySelectorAll('.notes-list').forEach(el=> el.classList.remove('notes-drop-target'));
                        const noteId = Number(evt.item.dataset.noteId);
                        const note = state.notes.find(n=>n.id===noteId);
                        if (note && !note.isFavorite) {
                            note.isFavorite = true;
                            note.updatedAt = new Date().toISOString();
                            showToast('Ajouté aux favoris ⭐ (glisser-déposer)');
                        }
                        handleNotesSidebarDrop(evt, 'fav');
                    },
                    onRemove: function(evt){
                        document.querySelectorAll('.notes-list').forEach(el=> el.classList.remove('notes-drop-target'));
                    }
                });
            }
        }
        function handleNotesSidebarDrop(evt, source) {
            try {
                const listEl = document.getElementById('notes-list');
                const favEl = document.getElementById('notes-fav-list');
                // Si le drop vient de la liste principale, on reconstruit l'ordre global à partir du DOM de #notes-list
                // (qui contient toutes les notes quand non filtré)
                if (source === 'main' && listEl) {
                    if (notesSearchQuery) { renderNotesSidebar(); return; }
                    const orderedIds = Array.from(listEl.children).filter(el=> el.classList.contains('note-item') && el.dataset.noteId).map(el=> Number(el.dataset.noteId));
                    if (!orderedIds.length) return;
                    // Les notes non visibles (ex. recherche) conservent leur place à la fin
                    const visibleSet = new Set(orderedIds);
                    const remaining = state.notes.filter(n=> !visibleSet.has(n.id));
                    // Reconstruit state.notes dans l'ordre du DOM + restants
                    const map = new Map(state.notes.map(n=>[n.id, n]));
                    const newOrder = orderedIds.map(id=> map.get(id)).filter(Boolean);
                    // Ajoute les restants (non affichés) à la fin dans leur ordre précédent
                    remaining.forEach(n=> newOrder.push(n));
                    // Assigne de nouveaux order séquentiels
                    newOrder.forEach((n,i)=> n.order = i);
                    state.notes = newOrder;
                    saveState();
                    renderNotesSidebar();
                    // Conserve la note active visuellement
                    if (currentNoteId != null) {
                        const activeNote = state.notes.find(n=>n.id===currentNoteId);
                        if (activeNote) activeNote.updatedAt = activeNote.updatedAt; // ne pas bump updatedAt pour ne pas casser l'ordre
                    }
                    showToast('Ordre des notes mis à jour');
                } else if (source === 'fav' && favEl) {
                    const favOrderedIds = Array.from(favEl.children).filter(el=> el.classList.contains('note-item')).map(el=> Number(el.dataset.noteId));
                    if (!favOrderedIds.length) return;
                    // Réordonne uniquement les favoris entre eux en préservant leur position relative globale
                    // On attribue des order qui les maintiennent groupés au début, dans l'ordre du DOM fav
                    // Stratégie : on donne aux favs les plus petits order (0..favOrderedIds.length-1) dans l'ordre du DOM,
                    // et aux non-favs la suite, en conservant leur ordre relatif précédent
                    const favSet = new Set(favOrderedIds);
                    const favMap = new Map(state.notes.filter(n=> favSet.has(n.id)).map(n=>[n.id, n]));
                    // Trie les non-favs par order actuel
                    const nonFavs = state.notes.filter(n=> !favSet.has(n.id)).sort((a,b)=> Number(a.order)-Number(b.order));
                    // Reconstruit : favs d'abord dans l'ordre du DOM, puis non-favs
                    const reorderedFavs = favOrderedIds.map(id=> favMap.get(id)).filter(Boolean);
                    let idx=0;
                    reorderedFavs.forEach(n=> n.order = idx++);
                    nonFavs.forEach(n=> n.order = idx++);
                    // Trie state.notes par order
                    state.notes.sort((a,b)=> Number(a.order)-Number(b.order));
                    saveState();
                    renderNotesSidebar();
                    showToast('Favoris réordonnés');
                }
            } catch(e){ console.error('handleNotesSidebarDrop', e); renderNotesSidebar(); }
        }
        function renderNoteItemHTML(note, isFavSection) {
            const preview = note.blocks.slice(0,2).map(b=>b.content).join(' ').substring(0,60) || 'Aucun contenu';
            const dateStr = formatNoteDate(note.updatedAt);
            const words = note.blocks.reduce((c,b)=>c + (b.content.trim()? b.content.trim().split(/\s+/).length:0),0);
            const favIcon = note.isFavorite ? '⭐' : '';
            return `<div class="note-item${note.parentId?' nested':''}" data-note-id="${note.id}" onclick="openNote(${note.id})" title="${escapeHtml(note.title)}">
                <div class="note-item-icon">${escapeHtml(note.icon)}</div>
                <div class="note-item-main">
                    <div class="note-item-title">${escapeHtml(note.title || 'Sans titre')} ${favIcon? '<span style="opacity:0.8; font-size:10px;">⭐</span>':''}</div>
                    <div class="note-item-meta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg> ${escapeHtml(preview)} <span style="opacity:0.5;">·</span> ${words} mots</div>
                </div>
                <div class="note-item-actions" onclick="event.stopPropagation()">
                    <button onclick="toggleNoteFavorite(${note.id})" class="fav${note.isFavorite?' active':''}" title="${note.isFavorite?'Retirer des favoris':'Favori'}"><svg width="12" height="12" viewBox="0 0 24 24" fill="${note.isFavorite?'currentColor':'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>
                    <button onclick="duplicateNote(${note.id})" title="Dupliquer"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/></svg></button>
                    <button onclick="deleteNote(${note.id})" title="Supprimer"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
                </div>
            </div>`;
        }
        function duplicateNote(noteId) {
            const orig = state.notes.find(n=>n.id===noteId);
            if(!orig) return;
            const now = new Date().toISOString();
            const copy = JSON.parse(JSON.stringify(orig));
            copy.id = generateNoteId();
            copy.title = orig.title + ' (copie)';
            copy.order = (orig.order!=null? Number(orig.order)+0.5 : Date.now());
            copy.isFavorite = false;
            copy.createdAt = now;
            copy.updatedAt = now;
            copy.blocks = copy.blocks.map(b=> ({...b, id: generateBlockId()}));
            state.notes.unshift(copy);
            saveState();
            renderNotesSidebar();
            openNote(copy.id);
            showToast('Page dupliquée');
        }
        function deleteNote(noteId) {
            const note = state.notes.find(n=>n.id===noteId);
            if(!note) return;
            if(!confirm(`Supprimer “${note.title||'Sans titre'}” ?`)) return;
            const idx = state.notes.findIndex(n=>n.id===noteId);
            state.notes.splice(idx,1);
            state.notes.forEach(n=>{ if(n.parentId===noteId) n.parentId=null; });
            if (currentNoteId===noteId) { currentNoteId=null; showNotesEmpty(); }
            saveState();
            renderNotesSidebar();
            showToast('Page supprimée');
        }
        function formatNoteDate(iso) {
            try {
                const d = new Date(iso);
                const now = new Date();
                const diff = (now - d)/1000;
                if (diff < 60) return 'à l\'instant';
                if (diff < 3600) return Math.floor(diff/60)+' min';
                if (diff < 86400) return Math.floor(diff/3600)+' h';
                if (diff < 604800) return Math.floor(diff/86400)+' j';
                return d.toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
            } catch(e){ return ''; }
        }
        function renderNotesEditor(noteId, scrollTop) {
            const note = state.notes.find(n=>n.id===noteId);
            if (!note) { showNotesEmpty(); return; }
            // FIX focus : mémorise où l'utilisateur est en train d'écrire pour
            // restaurer le focus (et le curseur) après le re-render déclenché
            // par la synchronisation.
            const _focusSnap = (typeof _notesCaptureFocus === 'function') ? _notesCaptureFocus() : null;
            const emptyState = document.getElementById('notes-empty-state');
            const editor = document.getElementById('notes-editor');
            if (emptyState) emptyState.style.display='none';
            if (editor) editor.style.display='flex';
            if (scrollTop) editor.scrollTop=0;
            // Cover
            const coverEl = document.getElementById('notes-cover');
            if (coverEl) {
                if (note.hasCover) {
                    coverEl.classList.remove('no-cover');
                    coverEl.style.background = note.cover;
                } else {
                    coverEl.classList.add('no-cover');
                    coverEl.style.background='transparent';
                }
            }
            // Icon
            const iconEl = document.getElementById('notes-icon-large');
            if (iconEl) {
                iconEl.textContent = note.icon || '📝';
                iconEl.classList.toggle('no-icon', !note.icon);
            }
            // Title
            const titleEl = document.getElementById('notes-title-input');
            if (titleEl) {
                // FIX focus : ne pas écraser le champ titre pendant que
                // l'utilisateur est en train d'y écrire (perte du curseur/IME).
                if (document.activeElement !== titleEl) {
                    titleEl.value = note.title;
                }
                // auto height
                titleEl.style.height='auto';
                titleEl.style.height= titleEl.scrollHeight+'px';
            }
            // Breadcrumb
            const bcTitle = document.getElementById('notes-breadcrumb-title');
            if (bcTitle) bcTitle.textContent = note.title || 'Sans titre';
            // Meta
            updateNotesMeta();
            // Fav button state
            const favBtn = document.getElementById('notes-fav-btn');
            if (favBtn) {
                favBtn.style.background = note.isFavorite ? '#FF9500' : 'transparent';
                favBtn.style.color = note.isFavorite ? 'white' : 'var(--ink-soft)';
                favBtn.style.borderColor = note.isFavorite ? '#FF9500' : 'var(--line)';
                favBtn.innerHTML = note.isFavorite ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Favori' : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Favori';
            }
            renderNotesBlocks();
            // FIX focus : redonne le focus au champ titre s'il était en cours d'édition
            if (_focusSnap && _focusSnap.kind === 'title' && typeof _notesRestoreFocus === 'function') {
                _notesRestoreFocus(_focusSnap);
            }
        }
        function updateNotesMeta() {
            const note = state.notes.find(n=>n.id===currentNoteId);
            if (!note) return;
            const dateEl = document.getElementById('notes-meta-date');
            const wordsEl = document.getElementById('notes-meta-words');
            if (dateEl) {
                const d = new Date(note.updatedAt);
                dateEl.textContent = 'Modifié ' + d.toLocaleDateString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
            }
            if (wordsEl) {
                const words = note.blocks.reduce((c,b)=> c + (b.content.trim()? b.content.trim().split(/\s+/).length:0),0);
                const blocks = note.blocks.length;
                wordsEl.textContent = words + ' mots · ' + blocks + ' blocs';
            }
        }
        function showNotesEmpty() {
            const emptyState = document.getElementById('notes-empty-state');
            const editor = document.getElementById('notes-editor');
            if (emptyState) emptyState.style.display='flex';
            if (editor) editor.style.display='none';
            const bcTitle = document.getElementById('notes-breadcrumb-title');
            if (bcTitle) bcTitle.textContent = '';
        }
        /* FIX focus : capture / restauration du focus + position du curseur.
           Sans ça, chaque re-render de l'éditeur (déclenché par la synchro du
           dossier Root) détruisait le bloc contenteditable actif : le focus
           tombait sur <body> et la saisie s'arrêtait net. */
        function _notesCaptureFocus() {
            try {
                const active = document.activeElement;
                if (!active) return null;
                if (active.id === 'notes-title-input') {
                    return { kind: 'title', start: active.selectionStart, end: active.selectionEnd };
                }
                if (active.isContentEditable && active.closest && active.closest('#notes-blocks')) {
                    const blockEl = active.closest('.note-block');
                    const sel = window.getSelection();
                    let start = null;
                    if (sel && sel.rangeCount > 0 && active.contains(sel.anchorNode)) {
                        try {
                            const r = sel.getRangeAt(0);
                            const pre = r.cloneRange();
                            pre.selectNodeContents(active);
                            pre.setEnd(r.startContainer, r.startOffset);
                            start = pre.toString().length;
                        } catch(e) {}
                    }
                    return { kind: 'block', blockId: blockEl ? blockEl.dataset.blockId : null, start };
                }
            } catch(e) {}
            return null;
        }
        function _notesRestoreFocus(snap) {
            if (!snap) return;
            try {
                if (snap.kind === 'title') {
                    const el = document.getElementById('notes-title-input');
                    if (el) {
                        el.focus({ preventScroll: true });
                        try {
                            const pos = (snap.start != null) ? Math.min(snap.start, el.value.length) : el.value.length;
                            el.setSelectionRange(pos, pos);
                        } catch(e) {}
                    }
                    return;
                }
                if (snap.kind === 'block' && snap.blockId != null) {
                    const el = document.querySelector(`[data-block-id="${snap.blockId}"] [contenteditable]`);
                    if (!el) return;
                    el.focus({ preventScroll: true });
                    let placed = false;
                    if (snap.start != null) {
                        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
                        let remaining = snap.start, node;
                        while ((node = walker.nextNode())) {
                            if (remaining <= node.length) {
                                const sel = window.getSelection();
                                const range = document.createRange();
                                range.setStart(node, remaining);
                                range.collapse(true);
                                sel.removeAllRanges();
                                sel.addRange(range);
                                placed = true;
                                break;
                            }
                            remaining -= node.length;
                        }
                    }
                    if (!placed) placeCaretAtEnd(el);
                }
            } catch(e) {}
        }
        function renderNotesBlocks() {
            const note = state.notes.find(n=>n.id===currentNoteId);
            const container = document.getElementById('notes-blocks');
            if (!note || !container) return;
            // FIX focus : on capture le bloc en cours d'édition AVANT de
            // reconstruire le DOM, et on restaure focus + curseur APRÈS.
            const _focusSnap = (document.activeElement && document.activeElement.isContentEditable) ? _notesCaptureFocus() : null;
            container.innerHTML = note.blocks.map((block, idx)=> renderBlockHTML(block, idx)).join('');
            // Restaure le focus visuel après re-render si on avait un bloc focus
            if (lastFocusedBlockId) {
                const toFocus = container.querySelector(`[data-block-id="${lastFocusedBlockId}"]`);
                if (toFocus) toFocus.classList.add('is-focused');
            }
            // Init sortable for drag
            initNotesSortable();
            // Highlight active block toolbar? update toolbar active state based on focused block type
            updateToolbarActive();
            // FIX focus : la saisie continue sans interruption
            if (_focusSnap) _notesRestoreFocus(_focusSnap);
        }
        function renderBlockHTML(block, idx) {
            const type = block.type;
            const placeholder = {
                paragraph: 'Tape “/” pour commander…',
                h1: 'Titre 1',
                h2: 'Titre 2',
                h3: 'Titre 3',
                bullet: 'Élément de liste',
                numbered: 'Élément numéroté',
                todo: 'À faire',
                quote: 'Citation',
                callout: 'Écris quelque chose…',
                task: 'Rechercher une tâche…',
                code: 'Écris ton code…',
                divider: ''
            }[type] || 'Tape quelque chose…';
            let inner = '';
            if (type==='divider') {
                inner = `<div class="note-block-content"><div class="divider-line"></div></div>`;
            } else if (type==='todo') {
                inner = `<div class="note-block-content">
                    <button class="todo-check ${block.checked?'checked':''}" onclick="toggleTodoBlock('${block.id}')" aria-label="Cocher">${block.checked?'✓':''}</button>
                    <div contenteditable="true" data-placeholder="${placeholder}" oninput="handleBlockInput('${block.id}', this)" onkeydown="handleBlockKeydown('${block.id}', event)" onpaste="handleBlockPaste('${block.id}', event)" onfocus="handleBlockFocus('${block.id}')">${escapeHtml(block.content)}</div>
                </div>`;
            } else if (type==='bullet') {
                inner = `<div class="note-block-content"><div class="bullet-dot"></div><div contenteditable="true" data-placeholder="${placeholder}" oninput="handleBlockInput('${block.id}', this)" onkeydown="handleBlockKeydown('${block.id}', event)" onpaste="handleBlockPaste('${block.id}', event)" onfocus="handleBlockFocus('${block.id}')">${escapeHtml(block.content)}</div></div>`;
            } else if (type==='numbered') {
                inner = `<div class="note-block-content"><div class="numbered-num">${idx+1}.</div><div contenteditable="true" data-placeholder="${placeholder}" oninput="handleBlockInput('${block.id}', this)" onkeydown="handleBlockKeydown('${block.id}', event)" onpaste="handleBlockPaste('${block.id}', event)" onfocus="handleBlockFocus('${block.id}')">${escapeHtml(block.content)}</div></div>`;
            } else if (type==='quote') {
                inner = `<div class="note-block-content"><div contenteditable="true" data-placeholder="${placeholder}" oninput="handleBlockInput('${block.id}', this)" onkeydown="handleBlockKeydown('${block.id}', event)" onpaste="handleBlockPaste('${block.id}', event)" onfocus="handleBlockFocus('${block.id}')">${escapeHtml(block.content)}</div></div>`;
            } else if (type==='callout') {
                inner = `<div class="note-block-content"><div class="callout-icon">💡</div><div contenteditable="true" data-placeholder="${placeholder}" oninput="handleBlockInput('${block.id}', this)" onkeydown="handleBlockKeydown('${block.id}', event)" onpaste="handleBlockPaste('${block.id}', event)" onfocus="handleBlockFocus('${block.id}')">${escapeHtml(block.content)}</div></div>`;
            } else if (type==='code') {
                inner = `<div class="note-block-content"><div class="code-header"><span>${escapeHtml(block.language||'txt')}</span><button class="notes-tool-btn" style="width:auto; padding:2px 6px; font-size:10px; height:auto;" onclick="copyCodeBlock('${block.id}')">Copier</button></div><div contenteditable="true" data-placeholder="${placeholder}" oninput="handleBlockInput('${block.id}', this)" onkeydown="handleBlockKeydown('${block.id}', event)" onpaste="handleBlockPaste('${block.id}', event)" onfocus="handleBlockFocus('${block.id}')">${escapeHtml(block.content)}</div></div>`;
            } else if (type==='task') {
                const card = block.cardId ? state.cards.find(c=>c.id===block.cardId) : null;
                const col = card ? state.columns.find(c=>c.id===card.columnId) : null;
                const isCompleted = col ? isCompletedColumn(col) : false;
                if (!card) {
                    const meta = block.taskMeta || {};
                    const title = block.content || meta.title || 'Tâche introuvable';
                    inner = `<div class="note-block-content"><div class="task-embed-placeholder">📌 Tâche supprimée ou introuvable : “${escapeHtml(title)}” <br><button class="btn btn-secondary" style="margin-top:8px; padding:6px 12px; font-size:12px;" onclick="relinkTaskBlock('${block.id}')">🔗 Relier à une autre tâche</button> <button class="btn btn-ghost" style="margin-top:8px; padding:6px 12px; font-size:12px;" onclick="deleteBlock('${block.id}')">Supprimer ce bloc</button></div></div>`;
                } else {
                    const colColor = card.categoryColor || (col ? col.color : '#0071E3');
                    const prioLabel = {high:'Haute', medium:'Moyenne', low:'Basse'}[card.priority] || card.priority;
                    const prioClass = card.priority || 'medium';
                    const deadlineText = card.deadline ? new Date(card.deadline).toLocaleDateString('fr-FR') : '';
                    const dateStatus = getDeadlineStatus ? getDeadlineStatus(card.deadline, card.scheduledTime) : '';
                    const checklistProg = card.checklist && card.checklist.length ? `${card.checklist.filter(i=>i.checked).length}/${card.checklist.length}` : '';
                    const timeStr = card.scheduledTime ? card.scheduledTime : '';
                    const titleEsc = escapeHtml(card.title);
                    const catEsc = escapeHtml(card.category || '');
                    inner = `<div class="note-block-content" onclick="showTaskSummary(${card.id})" title="Ouvrir la tâche">
                        <div class="task-embed ${isCompleted ? 'done' : ''}">
                            <div class="task-embed-color" style="background:${colColor}"></div>
                            <button class="task-embed-check ${isCompleted ? 'done' : ''}" onclick="event.stopPropagation(); toggleTaskEmbedCheck('${block.id}')" title="${isCompleted ? 'Marquer à faire' : 'Terminer'}">${isCompleted ? '✓' : ''}</button>
                            <div class="task-embed-main">
                                <div class="task-embed-title">${titleEsc}</div>
                                <div class="task-embed-meta">
                                    <span class="task-embed-badge ${prioClass}">${prioLabel}</span>
                                    ${catEsc ? `<span class="task-embed-badge category">${catEsc}</span>` : ''}
                                    ${checklistProg ? `<span class="task-embed-date"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v6a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> ${checklistProg}</span>` : ''}
                                    ${card.deadline ? `<span class="task-embed-date" style="${dateStatus==='overdue' ? 'color:var(--sys-red);' : dateStatus==='soon' ? 'color:#B85E00;' : ''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> ${deadlineText}</span>` : ''}
                                    ${timeStr ? `<span class="task-embed-date"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg> ${timeStr}</span>` : ''}
                                    <span class="task-embed-date" style="opacity:0.6;">${escapeHtml(col ? col.title : '')}</span>
                                </div>
                            </div>
                            <div class="task-embed-actions" onclick="event.stopPropagation()">
                                <button onclick="showTaskSummary(${card.id})" title="Ouvrir"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
                                <button onclick="relinkTaskBlock('${block.id}')" title="Changer la tâche"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg></button>
                                <button class="danger" onclick="deleteBlock('${block.id}')" title="Retirer"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg></button>
                            </div>
                        </div>
                    </div>`;
                }
            } else {
                inner = `<div class="note-block-content"><div contenteditable="true" data-placeholder="${placeholder}" oninput="handleBlockInput('${block.id}', this)" onkeydown="handleBlockKeydown('${block.id}', event)" onpaste="handleBlockPaste('${block.id}', event)" onfocus="handleBlockFocus('${block.id}')">${escapeHtml(block.content)}</div></div>`;
            }
            // add checked class for todo
            const extraClass = (type==='todo' && block.checked) ? ' checked' : '';
            return `<div class="note-block" data-block-id="${block.id}" data-type="${type}" draggable="false">
                <div class="note-block-controls">
                    <button class="note-block-handle" draggable="true" title="Glisser pour déplacer" aria-label="Déplacer"><svg viewBox="0 0 16 16" fill="currentColor"><circle cx="4" cy="4" r="1.2"/><circle cx="8" cy="4" r="1.2"/><circle cx="4" cy="8" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="4" cy="12" r="1.2"/><circle cx="8" cy="12" r="1.2"/></svg></button>
                    <button class="note-block-add" onclick="addBlockAfter('${block.id}')" title="Ajouter en dessous">+</button>
                </div>
                ${inner}
                <button class="notes-tool-btn" onclick="deleteBlock('${block.id}')" title="Supprimer" style="opacity:0; width:22px; height:22px; flex-shrink:0; margin-top:4px;" onmouseenter="this.style.opacity=1" ><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg></button>
            </div>`;
        }
        function handleBlockFocus(blockId) {
            lastFocusedBlockId = blockId;
            document.querySelectorAll('.note-block').forEach(el=> el.classList.remove('is-focused'));
            const cur = document.querySelector(`[data-block-id="${blockId}"]`);
            if (cur) cur.classList.add('is-focused');
            // Donne réellement le focus à l'éditable pour que getSelectedBlockIds / activeElement fonctionne
            // et pour que le curseur reste dans le bloc lors d'un clic toolbar (avec preventDefault)
            try {
                const editable = cur ? cur.querySelector('[contenteditable]') : null;
                if (editable && document.activeElement !== editable) {
                    // Ne force le focus que si on est déjà dans la vue notes (évite de voler le focus ailleurs)
                    const inNotes = document.getElementById('notes-container')?.classList.contains('is-visible');
                    if (inNotes) {
                        editable.focus({ preventScroll: true });
                        // Place le caret à la fin si aucune sélection
                        const sel = window.getSelection();
                        if (!sel || sel.rangeCount === 0 || !editable.contains(sel.anchorNode)) {
                            const range = document.createRange();
                            range.selectNodeContents(editable);
                            range.collapse(false);
                            sel.removeAllRanges();
                            sel.addRange(range);
                        }
                    }
                }
            } catch(e) {}
            updateToolbarActive();
        }
        // Nettoie le focus visuel quand on clique en dehors de la note (évite que la dernière ligne soit formatée par erreur)
        document.addEventListener('click', (e) => {
            const insideBlock = e.target.closest?.('.note-block');
            const insideToolbar = e.target.closest?.('#notes-toolbar');
            const insideSlash = e.target.closest?.('.slash-menu');
            if (!insideBlock && !insideToolbar && !insideSlash) {
                // Clic en dehors : on retire is-focused mais on garde lastFocusedBlockId pour d'éventuels raccourcis clavier ?
                // Pour la toolbar, on veut vraiment "seulement la sélection" donc on nettoie
                const notesVisible = document.getElementById('notes-container')?.classList.contains('is-visible');
                if (notesVisible && !e.target.closest?.('#notes-sidebar')) {
                    // Ne nettoie que si on était en vue notes
                    document.querySelectorAll('.note-block.is-focused').forEach(el=>el.classList.remove('is-focused'));
                    // On ne vide pas lastFocusedBlockId immédiatement pour permettre le clic toolbar avec preventDefault,
                    // mais on le videra après un délai si aucune sélection n'est revenue
                    setTimeout(()=>{
                        const sel = window.getSelection();
                        const hasSelectionInNotes = sel && sel.rangeCount>0 && sel.anchorNode && sel.anchorNode.parentElement?.closest?.('#notes-blocks');
                        const activeInNotes = document.activeElement?.closest?.('.note-block');
                        if (!hasSelectionInNotes && !activeInNotes) {
                            lastFocusedBlockId = null;
                            updateToolbarActive();
                        }
                    }, 120);
                }
            }
        });
        function updateToolbarActive() {
            const focused = document.querySelector('.note-block.is-focused');
            const type = focused?.dataset.type || null;
            document.querySelectorAll('#notes-toolbar .notes-tool-btn[data-type]').forEach(btn=>{
                btn.classList.toggle('active', btn.dataset.type===type);
            });
        }
        function initNotesSortable() {
            const container = document.getElementById('notes-blocks');
            if (!container || typeof Sortable==='undefined') return;
            if (notesSortable) { try{ notesSortable.destroy(); }catch(e){} }
            notesSortable = new Sortable(container, {
                handle: '.note-block-handle',
                draggable: '.note-block',
                animation: 180,
                easing: 'cubic-bezier(0.32,0.72,0,1)',
                ghostClass: 'dragging',
                chosenClass: 'dragging',
                onEnd: function(evt){
                    if (currentNoteId==null) return;
                    const note = state.notes.find(n=>n.id===currentNoteId);
                    if (!note) return;
                    const newOrder = Array.from(container.children).map(el=> el.dataset.blockId);
                    const map = new Map(note.blocks.map(b=>[b.id,b]));
                    note.blocks = newOrder.map(id=> map.get(id)).filter(Boolean);
                    note.updatedAt = new Date().toISOString();
                    saveState();
                    renderNotesBlocks();
                    renderNotesSidebar();
                }
            });
        }
        function copyCodeBlock(blockId){
            const note = state.notes.find(n=>n.id===currentNoteId);
            const block = note?.blocks.find(b=>b.id===blockId);
            if(!block) return;
            navigator.clipboard.writeText(block.content).then(()=> showToast('Code copié')).catch(()=> showToast('Copie impossible'));
        }

        // ========== Icon picker ==========
        function toggleIconPicker(e) {
            if (e) e.stopPropagation();
            const large = document.getElementById('notes-icon-large');
            if (!large) return;
            let picker = document.getElementById('notes-icon-picker');
            if (picker) {
                if (picker._cleanup) picker._cleanup();
                picker.remove();
                _notesIconPickerOpen=false;
                return;
            }
            picker = document.createElement('div');
            picker.id='notes-icon-picker';
            picker.className='notes-icon-picker';
            picker.innerHTML = NOTE_ICONS.map(ic=> `<button onclick="selectNoteIcon('${ic.replace(/'/g, "\\'")}')">${ic}</button>`).join('') + `<div style="grid-column:1/-1; display:flex; gap:6px; padding-top:6px; border-top:1px solid var(--line); margin-top:4px;"><button onclick="selectNoteIcon('')" style="flex:1; font-size:12px; font-weight:600;">Retirer</button><button onclick="hideIconPicker()" style="flex:1; font-size:12px; font-weight:600; background:var(--bg-alt);">Fermer</button></div>`;
            picker.addEventListener('click', ev=> ev.stopPropagation());
            document.body.appendChild(picker);
            const rect = large.getBoundingClientRect();
            const pickerW = 320;
            // Force layout to get height
            const pickerH = picker.offsetHeight || 280;
            let top = rect.bottom + 10;
            let left = rect.left;
            if (left + pickerW > window.innerWidth - 12) left = window.innerWidth - pickerW - 12;
            if (top + pickerH > window.innerHeight - 12) top = rect.top - pickerH - 10;
            if (top < 12) top = 12;
            if (left < 12) left = 12;
            picker.style.top = top + 'px';
            picker.style.left = left + 'px';
            const reposition = () => {
                const r = large.getBoundingClientRect();
                let t = r.bottom + 10;
                let l = r.left;
                if (l + pickerW > window.innerWidth - 12) l = window.innerWidth - pickerW - 12;
                if (t + pickerH > window.innerHeight - 12) t = r.top - pickerH - 10;
                if (t < 12) t = 12;
                if (l < 12) l = 12;
                picker.style.top = t + 'px';
                picker.style.left = l + 'px';
            };
            const onScroll = () => reposition();
            const onResize = () => reposition();
            window.addEventListener('scroll', onScroll, { passive:true });
            window.addEventListener('resize', onResize);
            picker._cleanup = () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); };
            _notesIconPickerOpen=true;
            setTimeout(()=> {
                const hideOnce = (ev) => {
                    if (picker && picker.contains(ev.target)) return;
                    if (large && large.contains(ev.target)) return;
                    hideIconPicker();
                    document.removeEventListener('click', hideOnce);
                };
                document.addEventListener('click', hideOnce);
            }, 60);
        }
        function hideIconPicker() {
            const picker = document.getElementById('notes-icon-picker');
            if (picker) {
                if (picker._cleanup) picker._cleanup();
                picker.remove();
            }
            _notesIconPickerOpen=false;
        }
        function selectNoteIcon(icon) {
            const note = state.notes.find(n=>n.id===currentNoteId);
            if (!note) return;
            note.icon = icon || '📝';
            note.updatedAt = new Date().toISOString();
            saveState();
            renderNotesEditor(currentNoteId, false);
            renderNotesSidebar();
            hideIconPicker();
            showToast(icon? 'Icône mise à jour':'Icône retirée');
        }


        // ========== Cover ==========
        function cycleNoteCover() {
            const note = state.notes.find(n=>n.id===currentNoteId);
            if (!note) return;
            note.hasCover = true;
            const idx = NOTE_COVERS.indexOf(note.cover);
            note.cover = NOTE_COVERS[(idx+1)%NOTE_COVERS.length];
            note.updatedAt = new Date().toISOString();
            saveState();
            renderNotesEditor(currentNoteId,false);
            showToast('Couverture changée');
        }
        function removeNoteCover() {
            const note = state.notes.find(n=>n.id===currentNoteId);
            if (!note) return;
            note.hasCover = false;
            note.updatedAt = new Date().toISOString();
            saveState();
            renderNotesEditor(currentNoteId,false);
            showToast('Couverture retirée');
        }

        // ========== Slash menu ==========
        function showSlashMenu(blockId) {
            const blockEl = document.querySelector(`[data-block-id="${blockId}"]`);
            if (!blockEl) return;
            hideSlashMenu();
            slashMenuBlockId = blockId;
            const rect = blockEl.getBoundingClientRect();
            slashMenuEl = document.createElement('div');
            slashMenuEl.className='slash-menu';
            slashMenuEl.id='slash-menu';
            slashMenuEl.innerHTML = `<div class="slash-menu-header">Blocs de base</div>` + BLOCK_TYPES.map(bt=> `
                <div class="slash-item" data-type="${bt.type}" onclick="changeBlockType('${blockId}','${bt.type}')">
                    <div class="slash-item-icon">${bt.icon}</div>
                    <div class="slash-item-main"><div class="slash-item-title">${bt.label}</div><div class="slash-item-desc">${bt.desc}</div></div>
                    <div class="slash-item-shortcut">${bt.shortcut}</div>
                </div>
            `).join('');
            // position below block, or above if near bottom
            document.body.appendChild(slashMenuEl);
            const menuRect = slashMenuEl.getBoundingClientRect();
            let top = rect.bottom + 6;
            let left = rect.left + 28;
            if (top + menuRect.height > window.innerHeight - 10) top = rect.top - menuRect.height - 6;
            if (left + menuRect.width > window.innerWidth - 10) left = window.innerWidth - menuRect.width - 10;
            slashMenuEl.style.top = top+'px';
            slashMenuEl.style.left = left+'px';
            // focus first
            const first = slashMenuEl.querySelector('.slash-item');
            if (first) first.classList.add('focused');
            // keyboard navigation
            slashMenuEl._keyHandler = (e)=>{
                if (!slashMenuEl) return;
                const items = Array.from(slashMenuEl.querySelectorAll('.slash-item'));
                let idx = items.findIndex(i=>i.classList.contains('focused'));
                if (e.key==='ArrowDown'){ e.preventDefault(); items[idx]?.classList.remove('focused'); idx=(idx+1)%items.length; items[idx].classList.add('focused'); items[idx].scrollIntoView({block:'nearest'}); }
                else if (e.key==='ArrowUp'){ e.preventDefault(); items[idx]?.classList.remove('focused'); idx=(idx-1+items.length)%items.length; items[idx].classList.add('focused'); items[idx].scrollIntoView({block:'nearest'});}
                else if (e.key==='Enter'){ e.preventDefault(); items[idx]?.click(); }
                else if (e.key==='Escape'){ hideSlashMenu(); }
            };
            document.addEventListener('keydown', slashMenuEl._keyHandler);
            // click outside to close
            setTimeout(()=> document.addEventListener('click', hideSlashMenu, { once:true }), 100);
        }
        function hideSlashMenu() {
            if (slashMenuEl) {
                if (slashMenuEl._keyHandler) document.removeEventListener('keydown', slashMenuEl._keyHandler);
                slashMenuEl.remove();
                slashMenuEl=null;
                slashMenuBlockId=null;
            }
        }

        // ========== Export ==========
        function exportCurrentNote() {
            if (currentNoteId==null) { showToast('Aucune note ouverte'); return; }
            const note = state.notes.find(n=>n.id===currentNoteId);
            if (!note) return;
            let md = `# ${note.title}\n\n`;
            md += `> ${note.icon} · Modifié ${new Date(note.updatedAt).toLocaleString('fr-FR')}\n\n`;
            note.blocks.forEach(b=>{
                switch(b.type){
                    case 'h1': md += `# ${b.content}\n\n`; break;
                    case 'h2': md += `## ${b.content}\n\n`; break;
                    case 'h3': md += `### ${b.content}\n\n`; break;
                    case 'bullet': md += `- ${b.content}\n`; break;
                    case 'numbered': md += `1. ${b.content}\n`; break;
                    case 'todo': md += `- [${b.checked?'x':' '}] ${b.content}\n`; break;
                    case 'quote': md += `> ${b.content}\n\n`; break;
                    case 'callout': md += `> 💡 ${b.content}\n\n`; break;
                    case 'code': md += "```\n"+b.content+"\n```\n\n"; break;
                    case 'divider': md += `---\n\n`; break;
                    default: md += b.content + "\n\n";
                }
            });
            const blob = new Blob([md], {type:'text/markdown;charset=utf-8;'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href=url; a.download = (note.title||'note').replace(/[^a-z0-9]/gi,'_').slice(0,40)+'.md';
            a.click(); URL.revokeObjectURL(url);
            showToast('Note exportée en Markdown');
        }

        // ========== Import Markdown ==========
        function triggerImportMarkdown() {
            const inp = document.getElementById('markdown-import-input');
            if (!inp) { showToast('Import indisponible'); return; }
            inp.value = '';
            inp.click();
        }
        function handleImportMarkdownFile(event) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) { showToast('Fichier trop volumineux (max 2 MB)'); return; }
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const text = e.target.result;
                    if (typeof text !== 'string' || !text.trim()) { showToast('Fichier vide'); return; }
                    const parsed = parseMarkdownToNote(text, file.name);
                    // Crée une nouvelle note à partir du markdown
                    const now = new Date().toISOString();
                    const note = sanitizeNote({
                        id: generateNoteId(),
                        title: parsed.title || file.name.replace(/\.[^.]+$/, '') || 'Import Markdown',
                        icon: parsed.icon || '📝',
                        cover: NOTE_COVERS[Math.floor(Math.random()*NOTE_COVERS.length)],
                        hasCover: true,
                        parentId: null,
                        isFavorite: false,
                        isArchived: false,
                        createdAt: now,
                        updatedAt: now,
                        blocks: parsed.blocks.length ? parsed.blocks : [createBlockData('paragraph', '')]
                    });
                    note.order = state.notes.length ? Math.min(...state.notes.map(n=> Number.isFinite(Number(n.order))?Number(n.order):0))-1 : 0;
                    state.notes.unshift(note);
                    // Assure nextNoteId cohérent
                    if (state.nextNoteId <= note.id) state.nextNoteId = note.id + 1;
                    // Normalise les order après insertion en tête
                    state.notes.forEach((n,i)=>{ if(n.order==null) n.order=i; });
                    saveState();
                    renderNotesSidebar();
                    openNote(note.id);
                    if (currentView !== 'notes') switchView('notes');
                    showToast(`Markdown importé : “${note.title}” · ${note.blocks.length} blocs`);
                } catch(err) {
                    console.error('Import markdown failed', err);
                    showToast('Erreur import : ' + (err.message || 'format invalide'));
                }
                // Reset input pour permettre réimport du même fichier
                event.target.value = '';
            };
            reader.onerror = function() { showToast('Lecture du fichier échouée'); event.target.value=''; };
            reader.readAsText(file, 'utf-8');
        }
        function parseMarkdownToNote(mdText, filename) {
            const lines = mdText.replace(/\r\n/g, '\n').split('\n');
            let title = '';
            let icon = '📝';
            let blocks = [];
            let i = 0;
            let inCode = false;
            let codeBuffer = [];
            let codeLang = 'txt';
            let pendingParagraph = [];

            function flushParagraph() {
                if (pendingParagraph.length) {
                    const text = pendingParagraph.join(' ').trim();
                    if (text) blocks.push(createBlockData('paragraph', text));
                    pendingParagraph = [];
                }
            }

            // Détection du header exporté: "# title" + "> icon · Modifié ..."
            let startIdx = 0;
            if (lines[0] && /^#\s+/.test(lines[0])) {
                title = lines[0].replace(/^#\s+/, '').trim();
                startIdx = 1;
                // saute ligne vide
                while (lines[startIdx] !== undefined && lines[startIdx].trim() === '') startIdx++;
                if (lines[startIdx] && /^>\s*/.test(lines[startIdx])) {
                    const m = lines[startIdx].trim();
                    // extrait premier emoji / caractère avant "·" si présent
                    const iconMatch = m.match(/^>\s*([^\s·]+)/);
                    if (iconMatch && iconMatch[1]) icon = iconMatch[1].trim();
                    startIdx++;
                    while (lines[startIdx] !== undefined && lines[startIdx].trim() === '') startIdx++;
                }
            } else {
                // Pas de titre exporté, on prendra le filename plus tard
            }

            for (let idx = startIdx; idx < lines.length; idx++) {
                let line = lines[idx];
                // Gestion bloc code
                if (/^```/.test(line.trim())) {
                    if (!inCode) {
                        flushParagraph();
                        inCode = true;
                        codeLang = line.trim().slice(3).trim() || 'txt';
                        codeBuffer = [];
                    } else {
                        // fin de code
                        inCode = false;
                        const content = codeBuffer.join('\n');
                        const b = createBlockData('code', content);
                        b.language = codeLang || 'txt';
                        blocks.push(b);
                        codeBuffer = [];
                        codeLang = 'txt';
                    }
                    continue;
                }
                if (inCode) {
                    codeBuffer.push(line);
                    continue;
                }

                const trimmed = line.trim();

                if (trimmed === '') {
                    flushParagraph();
                    continue;
                }

                // Divider
                if (/^(---\s*|\*\*\*\s*|___\s*)$/.test(trimmed)) {
                    flushParagraph();
                    blocks.push(createBlockData('divider', ''));
                    continue;
                }
                // Headings
                if (/^###\s+/.test(trimmed)) {
                    flushParagraph();
                    blocks.push(createBlockData('h3', trimmed.replace(/^###\s+/, '').trim()));
                    continue;
                }
                if (/^##\s+/.test(trimmed)) {
                    flushParagraph();
                    blocks.push(createBlockData('h2', trimmed.replace(/^##\s+/, '').trim()));
                    continue;
                }
                if (/^#\s+/.test(trimmed)) {
                    // Si titre déjà pris depuis l'en-tête exporté, ce # suivant est un vrai H1
                    // Mais si on n'a pas encore de titre (import générique), le premier H1 devient le titre de la note
                    const h1Text = trimmed.replace(/^#\s+/, '').trim();
                    if (!title) {
                        title = h1Text;
                        // Ne crée pas de bloc H1 redondant si le titre de la note == ce H1 et qu'il est en tête
                        // On skip si c'est la première vraie ligne après startIdx
                        // Mais on garde le bloc si l'utilisateur veut vraiment un H1 dans le contenu
                        // Stratégie: si title vient de ce H1 et qu'on n'a encore aucun bloc, on ne pousse pas de bloc H1 séparé
                        // L'utilisateur verra le titre dans la barre de titre de la note
                        continue;
                    } else {
                        flushParagraph();
                        blocks.push(createBlockData('h1', h1Text));
                        continue;
                    }
                }
                // Todo
                let todoMatch = trimmed.match(/^-\s*\[( |x|X)\]\s*(.*)$/);
                if (todoMatch) {
                    flushParagraph();
                    const checked = todoMatch[1].toLowerCase() === 'x';
                    const b = createBlockData('todo', todoMatch[2].trim());
                    b.checked = checked;
                    blocks.push(b);
                    continue;
                }
                // Bullet
                if (/^[-*]\s+/.test(trimmed)) {
                    flushParagraph();
                    blocks.push(createBlockData('bullet', trimmed.replace(/^[-*]\s+/, '').trim()));
                    continue;
                }
                // Numbered (1. , 1) etc)
                if (/^\d+[\.)]\s+/.test(trimmed)) {
                    flushParagraph();
                    blocks.push(createBlockData('numbered', trimmed.replace(/^\d+[\.)]\s+/, '').trim()));
                    continue;
                }
                // Blockquote / Callout
                if (/^>\s*/.test(trimmed)) {
                    flushParagraph();
                    const inner = trimmed.replace(/^>\s*/, '').trim();
                    if (/^💡\s*/.test(inner) || /^\[callout\]/i.test(inner)) {
                        blocks.push(createBlockData('callout', inner.replace(/^💡\s*/, '').replace(/^\[callout\]\s*/i,'').trim()));
                    } else {
                        blocks.push(createBlockData('quote', inner));
                    }
                    continue;
                }
                // Paragraphe normal : accumule pour fusionner les lignes consécutives
                pendingParagraph.push(trimmed);
            }
            // Code non fermé
            if (inCode) {
                const content = codeBuffer.join('\n');
                const b = createBlockData('code', content);
                b.language = codeLang;
                blocks.push(b);
            }
            flushParagraph();

            // Fallbacks
            if (!title) {
                const base = (filename || '').replace(/\.[^.]+$/, '').trim();
                title = base || 'Import Markdown';
            }
            // Nettoie titre (max 80 chars)
            title = title.substring(0, 80).trim() || 'Import Markdown';
            // Assure au moins un bloc
            if (blocks.length === 0) blocks.push(createBlockData('paragraph', ''));
            // Limite blocs pour éviter explosion
            if (blocks.length > 500) {
                blocks = blocks.slice(0, 500);
                blocks.push(createBlockData('callout', '… import tronqué à 500 blocs'));
            }
            return { title, icon, blocks };
        }
        // Expose pour tests
        window.parseMarkdownToNote = parseMarkdownToNote;
        window.triggerImportMarkdown = triggerImportMarkdown;
        window.handleImportMarkdownFile = handleImportMarkdownFile;


        // ========== Sidebar mobile ==========
        function toggleNotesSidebar(force) {
            const sidebar = document.getElementById('notes-sidebar');
            const overlay = document.getElementById('notes-sidebar-overlay');
            if (!sidebar) return;
            const isOpen = sidebar.classList.contains('mobile-open');
            const shouldOpen = typeof force==='boolean' ? force : !isOpen;
            sidebar.classList.toggle('mobile-open', shouldOpen);
            if (overlay) overlay.classList.toggle('visible', shouldOpen);
            document.body.style.overflow = shouldOpen ? 'hidden' : '';
        }

        // ========== Integration with view switcher ==========
        (function patchSwitchView(){
            const _origSwitchView = window.switchView;
            window.switchView = function(view) {
                // Day est un overlay (pas un conteneur principal) : ne masque pas les notes via cette branche
                if (_origSwitchView && view!=='notes' && view!=='day') {
                    // Call original to hide board/calendar properly
                    _origSwitchView(view);
                    // Ensure notes hidden
                    const nc = document.getElementById('notes-container');
                    if (nc){ nc.style.display='none'; nc.classList.remove('is-visible'); }
                    const nb = document.getElementById('view-notes-btn');
                    if (nb) nb.classList.remove('active');
                    currentView = view;
                    refreshStatsBarState();
                    return;
                }
                if (view==='day') { openDaySummary(); return; }
                if (view==='notes') {
                    currentView = 'notes';
                    const boardContainer = document.querySelector('.board-container');
                    const calendarContainer = document.getElementById('calendar-container');
                    const notesContainer = document.getElementById('notes-container');
                    const boardBtn = document.getElementById('view-board-btn');
                    const calBtn = document.getElementById('view-calendar-btn');
                    const notesBtn = document.getElementById('view-notes-btn');
                    const dayBtn = document.getElementById('view-day-btn');
                    if (boardContainer){ boardContainer.style.display='none'; boardContainer.classList.add('is-hidden'); }
                    if (calendarContainer){ calendarContainer.style.display='none'; calendarContainer.classList.add('is-hidden'); }
                    if (dayBtn) dayBtn.classList.remove('active');
                    if (boardBtn) boardBtn.classList.remove('active');
                    if (calBtn) calBtn.classList.remove('active');
                    if (notesBtn) notesBtn.classList.add('active');
                    if (notesContainer){ notesContainer.style.display='flex'; notesContainer.classList.add('is-visible'); }
                    // Render notes
                    ensureNotesState();
                    renderNotesSidebar();
                    if (currentNoteId==null && state.notes.length>0) {
                        // Try to restore from hash
                        const hash = location.hash;
                        if (hash.startsWith('#note-')) {
                            const hid = Number(hash.replace('#note-',''));
                            if (state.notes.some(n=>n.id===hid)) currentNoteId=hid;
                            else currentNoteId=state.notes[0].id;
                        } else {
                            currentNoteId=state.notes[0].id;
                        }
                        renderNotesEditor(currentNoteId, true);
                    } else if (currentNoteId!=null) {
                        renderNotesEditor(currentNoteId, false);
                    } else {
                        showNotesEmpty();
                    }
                    // Close day overlay if open
                    const dayOverlay = document.getElementById('day-container');
                    if (dayOverlay && dayOverlay.classList.contains('open')) {
                        try{ closeDaySummary(); }catch(e){}
                    }
                    refreshStatsBarState();
                } else if (_origSwitchView) {
                    // fallback
                    _origSwitchView(view);
                }
            };
            // Patch openDaySummary: ne masque PAS les notes (l'overlay est modal au-dessus)
            // On garde les notes/board visibles derrière le blur, et on marque la vue Journée comme active
            const _origOpenDay = window.openDaySummary;
            if (_origOpenDay) {
                window.openDaySummary = function(){
                    const nb = document.getElementById('view-notes-btn');
                    const db = document.getElementById('view-day-btn');
                    const bb = document.getElementById('view-board-btn');
                    const cb = document.getElementById('view-calendar-btn');
                    // Active le bouton Journée, désactive les autres sans masquer les conteneurs (overlay par-dessus)
                    if (db) db.classList.add('active');
                    if (nb) nb.classList.remove('active');
                    if (bb) bb.classList.remove('active');
                    if (cb) cb.classList.remove('active');
                    const res = _origOpenDay.apply(this, arguments);
                    // S'assure que day-container est bien au-dessus
                    return res;
                };
                // Patch closeDaySummary pour restaurer l'état du bouton actif selon currentView
                const _origCloseDay = window.closeDaySummary;
                if (_origCloseDay) {
                    window.closeDaySummary = function(){
                        const res = _origCloseDay.apply(this, arguments);
                        // Après fermeture, restaure les boutons selon la vue sous-jacente (notes vs board)
                        setTimeout(()=>{
                            const nc = document.getElementById('notes-container');
                            const isNotes = nc && nc.classList.contains('is-visible');
                            const db = document.getElementById('view-day-btn');
                            const nb = document.getElementById('view-notes-btn');
                            const bb = document.getElementById('view-board-btn');
                            if (db) db.classList.remove('active');
                            if (isNotes) {
                                if (nb) nb.classList.add('active');
                            } else {
                                // Si on était sur notes, on y reste ; sinon on repasse en board par défaut si aucun conteneur visible
                                const boardContainer = document.querySelector('.board-container');
                                const calendarContainer = document.getElementById('calendar-container');
                                const boardVisible = boardContainer && boardContainer.style.display !== 'none' && !boardContainer.classList.contains('is-hidden');
                                const calVisible = calendarContainer && calendarContainer.style.display !== 'none' && !calendarContainer.classList.contains('is-hidden');
                                if (!boardVisible && !calVisible && !isNotes) {
                                    // Aucun conteneur visible (cas bug précédent) -> restaure la vue précédente (notes si elle était active, sinon board)
                                    if (window.currentView === 'notes' || isNotes) {
                                        if (nb) nb.classList.add('active');
                                    } else {
                                        if (bb) bb.classList.add('active');
                                        if (boardContainer) { boardContainer.style.display=''; boardContainer.classList.remove('is-hidden'); }
                                    }
                                } else {
                                    if (boardVisible && bb) bb.classList.add('active');
                                    if (calVisible && cb) cb.classList.add('active');
                                }
                            }
                        }, 360);
                        return res;
                    };
                }
            }
        })();

        // ========== Task -> Note link (add to card menu) ==========
        (function patchCardMenu(){
            // We will hook into the card menu creation if exists; simpler: add global function to create note from task
            window.createNoteFromTask = function(cardId){
                closeCardMenu();
                const card = state.cards.find(c=>c.id===cardId);
                if(!card) return;
                const now = new Date().toISOString();
                const note = sanitizeNote({
                    id: generateNoteId(),
                    title: card.title || 'Note — '+(card.category||'Tâche'),
                    icon: '📝',
                    cover: NOTE_COVERS[2],
                    hasCover: true,
                    parentId: null,
                    isFavorite: false,
                    createdAt: now,
                    updatedAt: now,
                    blocks: [
                        createBlockData('h1', card.title||'Sans titre'),
                        createBlockData('callout', card.description ? card.description.substring(0,200) : 'Note liée à une tâche — ajoute tes détails ici.'),
                        createBlockData('paragraph', `Priorité: ${card.priority||'—'} · Catégorie: ${card.category||'—'} · Échéance: ${card.deadline||'—'}`),
                        createBlockData('divider',''),
                        createBlockData('paragraph',''),
                        createBlockData('h2','Notes'),
                        createBlockData('todo','Préparer'),
                        createBlockData('todo','Exécuter'),
                        createBlockData('todo','Vérifier'),
                    ]
                });
                note.order = state.notes.length ? Math.min(...state.notes.map(n=> Number.isFinite(Number(n.order))?Number(n.order):0))-1 : 0;
                state.notes.unshift(note);
                saveState();
                renderNotesSidebar();
                switchView('notes');
                openNote(note.id);
                showToast('Note créée depuis la tâche');
            };
        })();

        // ========== Init notes on boot ==========
        (function initNotesBoot(){
            // Ensure state has notes after initial load
            const _origInit = window.init;
            // Instead of wrapping init, we hook after DOMContentLoaded and also patch load functions
            document.addEventListener('DOMContentLoaded', ()=>{
                setTimeout(()=>{
                    try {
                        ensureNotesState();
                        renderNotesSidebar();
                        // Handle deep link #note-xxx
                        if (location.hash.startsWith('#note-')) {
                            const nid = Number(location.hash.replace('#note-',''));
                            if (state.notes.some(n=>n.id===nid)) {
                                currentNoteId=nid;
                                switchView('notes');
                            }
                        }
                    } catch(e){ console.warn('init notes failed', e); }
                }, 400);
            });
            // Also after state loaded from file/local, we need to ensure notes are there
            const _origLoadLocal = window.loadStateLocal;
            if (_origLoadLocal) {
                window.loadStateLocal = function(){
                    const r = _origLoadLocal.apply(this, arguments);
                    try{ ensureNotesState(); renderNotesSidebar(); updateNotesCount(); }catch(e){}
                    return r;
                };
            }
            const _origLoadFile = window.loadStateFromFile;
            if (_origLoadFile) {
                window.loadStateFromFile = async function(){
                    const r = await _origLoadFile.apply(this, arguments);
                    try{ ensureNotesState(); renderNotesSidebar(); updateNotesCount(); }catch(e){}
                    return r;
                };
            }
        })();

        // Patch card menu to show "Créer une note"
        (function patchShowCardMenu(){
            const _origShowCardMenu = window.showCardMenu;
            if (_origShowCardMenu) {
                window.showCardMenu = function(cardId, x, y){
                    const result = _origShowCardMenu(cardId, x, y);
                    // Append extra item after menu is created
                    setTimeout(()=>{
                        const menu = document.getElementById('card-menu');
                        if (!menu || menu.querySelector('[data-note-action]')) return;
                        const btn = document.createElement('button');
                        btn.setAttribute('data-note-action','1');
                        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/></svg> Créer une note';
                        btn.onclick = () => createNoteFromTask(cardId);
                        btn.style.marginTop='4px';
                        btn.style.borderTop='1px solid var(--line)';
                        btn.style.paddingTop='10px';
                        menu.appendChild(btn);
                    }, 10);
                    return result;
                };
            }
        })();

        // Global keyboard shortcuts for notes
        document.addEventListener('keydown', (e)=>{
            if (currentView!=='notes') return;
            const tag = (e.target||{}).tagName;
            const isInput = tag==='INPUT' || tag==='TEXTAREA' || (e.target||{}).isContentEditable;
            if ((e.ctrlKey||e.metaKey) && e.key==='n') {
                if (currentView==='notes') { e.preventDefault(); createNewNote(); }
            }
            if (e.key==='Escape' && slashMenuEl) { e.preventDefault(); hideSlashMenu(); }
        });

        // Auto-save on visibility change (ensure sync)
        document.addEventListener('visibilitychange', ()=>{
            if (document.hidden && currentNoteId!=null) {
                // flush pending save
                if (_notesSaveDebounce) { clearTimeout(_notesSaveDebounce); saveState(); _notesSaveDebounce=null; }
            }
        });

        // Expose for debugging
        window.VN_NOTES = {
            get state(){ return state; },
            get currentNoteId(){ return currentNoteId; },
            openNote, createNewNote, renderNotesSidebar, renderNotesEditor
        };
        console.log('VN Notes prêt — synchronisation temps réel activée');


        /* ============================================================
           TASK ↔ NOTES SYNCHRONISATION (bidirectionnelle)
           - Intégrer une tâche existante dans une note (bloc task)
           - Créer une tâche Kanban depuis une note en 1 clic
           - Les modifications de la tâche se reflètent instantanément dans la note
           ============================================================ */
        let _taskPickerBlockId = null;
        let _taskPickerFilter = '';

        function showTaskPickerForBlock(blockId) {
            _taskPickerBlockId = blockId;
            _taskPickerFilter = '';
            // If block already has a task, pre-select it
            const note = state.notes.find(n=>n.id===currentNoteId);
            const block = note?.blocks.find(b=>b.id===blockId);
            const existingCardId = block?.cardId || null;
            openTaskPickerModal(existingCardId, block ? block.content : '');
        }
        function relinkTaskBlock(blockId) { showTaskPickerForBlock(blockId); }

        function openTaskPickerModal(selectedCardId, initialTitleHint) {
            // Build modal
            const existing = document.querySelector('.task-picker-modal');
            if (existing) existing.remove();
            const modal = document.createElement('div');
            modal.className = 'task-picker-modal';
            modal.id = 'task-picker-modal';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            const titleHint = initialTitleHint ? initialTitleHint.trim().substring(0,40) : '';
            modal.innerHTML = `
                <div class="task-picker-card" role="document">
                    <div class="task-picker-header">
                        <h3><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M9 14l2 2 4-4"/></svg> Choisir une tâche</h3>
                        <button class="modal-close" onclick="closeTaskPickerModal()" aria-label="Fermer">×</button>
                    </div>
                    <div class="task-picker-search">
                        <div class="task-picker-search-wrap">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
                            <input type="search" id="task-picker-search" placeholder="Rechercher une tâche…" autocomplete="off" oninput="filterTaskPicker(this.value)">
                        </div>
                    </div>
                    <div class="task-picker-create" onclick="createTaskFromPicker()" id="task-picker-create-btn" title="Créer une nouvelle tâche à partir du titre">
                        <div class="task-picker-create-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></div>
                        <div style="flex:1; min-width:0;">
                            <div style="font-size:13px; font-weight:700; color:var(--blue);">Créer une nouvelle tâche</div>
                            <div style="font-size:11px; color:var(--ink-soft);" id="task-picker-create-hint">${titleHint ? `“${escapeHtml(titleHint)}” → dans Aujourd'hui` : `Saisis un titre ou choisis une tâche existante`}</div>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
                    </div>
                    <div class="task-picker-list" id="task-picker-list"></div>
                    <div class="task-picker-footer">
                        <button class="btn btn-secondary" onclick="closeTaskPickerModal()">Annuler</button>
                        <button class="btn btn-primary" onclick="confirmTaskPicker()" id="task-picker-confirm" disabled>Sélectionner</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.addEventListener('click', (e)=> { if(e.target===modal) closeTaskPickerModal(); });
            document.addEventListener('keydown', taskPickerKeyHandler);
            // Render list
            renderTaskPickerList(selectedCardId);
            // Focus search
            setTimeout(()=> {
                const inp = document.getElementById('task-picker-search');
                if(inp) inp.focus();
                updateTaskPickerCreateHint();
            }, 60);
        }
        function closeTaskPickerModal() {
            const m = document.getElementById('task-picker-modal');
            if(m) m.remove();
            document.removeEventListener('keydown', taskPickerKeyHandler);
            _taskPickerBlockId = null;
        }
        function taskPickerKeyHandler(e) {
            if(e.key==='Escape') closeTaskPickerModal();
        }
        function filterTaskPicker(q) {
            _taskPickerFilter = (q||'').toLowerCase().trim();
            renderTaskPickerList();
            updateTaskPickerCreateHint();
        }
        function updateTaskPickerCreateHint() {
            const hint = document.getElementById('task-picker-create-hint');
            const inp = document.getElementById('task-picker-search');
            const v = inp ? inp.value.trim() : '';
            if(hint) {
                if(v) hint.textContent = `Créer “${v.substring(0,40)}” → dans Aujourd'hui`;
                else {
                    const note = state.notes.find(n=>n.id===currentNoteId);
                    const block = note?.blocks.find(b=>b.id===_taskPickerBlockId);
                    const t = block?.content?.trim().substring(0,40) || '';
                    hint.textContent = t ? `“${t}” → dans Aujourd'hui` : `Saisis un titre ou choisis une tâche existante`;
                }
            }
        }
        function renderTaskPickerList(selectedId) {
            const list = document.getElementById('task-picker-list');
            if(!list) return;
            const filter = _taskPickerFilter;
            let cards = [...state.cards];
            // Search filter
            if(filter) {
                cards = cards.filter(c=>{
                    const hay = (c.title + ' ' + (c.description||'') + ' ' + (c.category||'') + ' ' + (c.priority||'')).toLowerCase();
                    return hay.includes(filter);
                });
            }
            // Sort: not completed first, then by deadline/priority, then updated?
            cards.sort((a,b)=>{
                const colA = state.columns.find(c=>c.id===a.columnId);
                const colB = state.columns.find(c=>c.id===b.columnId);
                const doneA = colA ? isCompletedColumn(colA) : false;
                const doneB = colB ? isCompletedColumn(colB) : false;
                if(doneA!==doneB) return doneA - doneB;
                // more recent first? use createdAt
                return new Date(b.createdAt||0) - new Date(a.createdAt||0);
            });
            if(cards.length===0) {
                list.innerHTML = `<div class="task-picker-empty">Aucune tâche trouvée<br><span style="font-size:12px; opacity:0.7;">Crée une nouvelle tâche avec le bouton ci-dessus.</span></div>`;
                return;
            }
            // Group by column
            const groups = new Map();
            cards.forEach(c=>{
                const col = state.columns.find(col=>col.id===c.columnId);
                const label = col ? col.title : 'Sans colonne';
                const color = col ? col.color : '#6E6E73';
                const key = label + '|' + color;
                if(!groups.has(key)) groups.set(key, []);
                groups.get(key).push(c);
            });
            let html = '';
            groups.forEach((groupCards, key)=>{
                const [label, color] = key.split('|');
                html += `<div class="task-picker-group-label"><span class="dot" style="background:${color}"></span> ${escapeHtml(label)} · ${groupCards.length}</div>`;
                groupCards.slice(0,12).forEach(card=>{
                    const col = state.columns.find(c=>c.id===card.columnId);
                    const prio = card.priority || 'medium';
                    const prioDot = prio==='high' ? 'var(--sys-red)' : prio==='low' ? 'var(--sys-green)' : 'var(--sys-orange)';
                    const desc = card.description ? card.description.substring(0,60) : (card.deadline ? 'Échéance '+ new Date(card.deadline).toLocaleDateString('fr-FR') : 'Sans échéance');
                    const isSel = selectedId && card.id===selectedId;
                    const check = card.checklist && card.checklist.length ? `${card.checklist.filter(i=>i.checked).length}/${card.checklist.length}` : '';
                    html += `<div class="task-picker-item ${isSel?'selected':''}" data-card-id="${card.id}" onclick="selectTaskPickerItem(${card.id})">
                        <div class="task-picker-item-icon" style="border-color:${col?col.color:'#D2D2D7'}; color:${prioDot};">${prio==='high' ? '!' : prio==='low' ? '·' : '•'}</div>
                        <div class="task-picker-item-main">
                            <div class="task-picker-item-title">${escapeHtml(card.title)}</div>
                            <div class="task-picker-item-desc">${escapeHtml(desc)} ${check ? `· ${check}` : ''} ${card.category ? `· ${escapeHtml(card.category)}` : ''}</div>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${isSel?'var(--blue)':'#C7C7CC'}" stroke-width="2.2" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                    </div>`;
                });
                if(groupCards.length>12) html += `<div style="font-size:11px; color:var(--ink-soft); padding:4px 8px; text-align:center;">+${groupCards.length-12} autres… affine ta recherche</div>`;
            });
            list.innerHTML = html;
            // Update confirm button state
            const confirmBtn = document.getElementById('task-picker-confirm');
            if(confirmBtn) confirmBtn.disabled = !document.querySelector('.task-picker-item.selected');
        }
        function selectTaskPickerItem(cardId) {
            document.querySelectorAll('.task-picker-item').forEach(el=> el.classList.remove('selected'));
            const target = document.querySelector(`.task-picker-item[data-card-id="${cardId}"]`);
            if(target) target.classList.add('selected');
            const btn = document.getElementById('task-picker-confirm');
            if(btn) btn.disabled = false;
            // Update create hint? hide create when selecting
        }
        function confirmTaskPicker() {
            const sel = document.querySelector('.task-picker-item.selected');
            if(!sel) { showToast('Sélectionne une tâche'); return; }
            const cardId = Number(sel.dataset.cardId);
            embedTaskInCurrentBlock(cardId);
            closeTaskPickerModal();
        }
        function embedTaskInCurrentBlock(cardId) {
            if(_taskPickerBlockId==null || currentNoteId==null) return;
            const note = state.notes.find(n=>n.id===currentNoteId);
            const block = note?.blocks.find(b=>b.id===_taskPickerBlockId);
            if(!note || !block) return;
            const card = state.cards.find(c=>c.id===cardId);
            if(!card) { showToast('Tâche introuvable'); return; }
            block.type = 'task';
            block.cardId = cardId;
            block.content = card.title; // snapshot
            block.taskMeta = { title: card.title, category: card.category };
            note.updatedAt = new Date().toISOString();
            saveState();
            renderNotesBlocks();
            renderNotesSidebar();
            showToast('Tâche intégrée à la note ✓');
        }
        function createTaskFromPicker() {
            // Ouvre le même dialogue Kanban que "Nouvelle tâche rapide" — pré-rempli
            const inp = document.getElementById('task-picker-search');
            let title = inp ? inp.value.trim() : '';
            if(!title) {
                const note = state.notes.find(n=>n.id===currentNoteId);
                const block = note?.blocks.find(b=>b.id===_taskPickerBlockId);
                title = block?.content?.trim() || '';
            }
            // Sauvegarde le block cible avant de fermer le picker (showAddCardModal l'écraserait sinon)
            const pendingBlockId = _taskPickerBlockId;
            // On garde une référence pour l'embed après création
            _notesPendingEmbed = { blockId: pendingBlockId, hint: title };
            // Ferme le picker puis ouvre le dialogue Kanban
            closeTaskPickerModal();
            // Réassigne après fermeture (closeTaskPickerModal nullifie _taskPickerBlockId)
            _notesPendingEmbed.blockId = pendingBlockId;
            // On doit aussi restaurer _taskPickerBlockId pour que l'embed sache où intégrer si l'utilisateur valide via le hook createCard
            _taskPickerBlockId = pendingBlockId;
            openKanbanTaskModalForNote(pendingBlockId, title);
        }

        // Quick create: button in block controls or slash "Nouvelle tâche"
        function createTaskFromBlock(blockId) {
            const note = state.notes.find(n=>n.id===currentNoteId);
            const block = note?.blocks.find(b=>b.id===blockId);
            if(!note || !block) return;
            let title = block.content.trim();
            if(!title) title = prompt('Titre de la tâche à créer :');
            if(!title || !title.trim()) { showToast('Titre requis'); return; }
            title = title.trim();
            const todayCol = findColumnByRole('today') || state.columns[0];
            const newCard = {
                id: allocateId('card'),
                columnId: todayCol.id,
                title: title,
                description: `Créé depuis la note “${note.title}”`,
                startDate: localDateStr(new Date()),
                duration: null,
                scheduledTime: null,
                deadline: null,
                priority: 'medium',
                category: null,
                categoryColor: '#0071E3',
                recurrence: { type:'none' },
                checklist: [],
                completionNote: null,
                timeHistory: [],
                totalTimeSpent: 0,
                createdAt: new Date().toISOString()
            };
            state.cards.push(newCard);
            saveState();
            renderBoard();
            updateStats();
            // Convert this block to task embed
            block.type = 'task';
            block.cardId = newCard.id;
            block.content = title;
            note.updatedAt = new Date().toISOString();
            saveState();
            renderNotesBlocks();
            renderNotesSidebar();
            showToast(`Tâche créée depuis la note`);
        }
        // Add a helper to quickly turn a paragraph into a task (shown in block controls via long press? We'll expose as button)
        // We'll monkey-patch renderBlockHTML to add a small "→ Tâche" button for non-task blocks (already handled via slash menu)

        function toggleTaskEmbedCheck(blockId) {
            const note = state.notes.find(n=>n.id===currentNoteId);
            const block = note?.blocks.find(b=>b.id===blockId);
            if(!block || block.type!=='task' || !block.cardId) return;
            const card = state.cards.find(c=>c.id===block.cardId);
            if(!card) return;
            const col = state.columns.find(c=>c.id===card.columnId);
            const completedCol = findColumnByRole('completed');
            if(!completedCol) { showToast('Colonne Terminé introuvable'); return; }
            const isDone = col && isCompletedColumn(col);
            if(isDone) {
                // Move back to Aujourd'hui
                const todayCol = findColumnByRole('today') || state.columns[0];
                card.columnId = todayCol.id;
                card.completedAt = null;
                showToast(`Tâche “${card.title}” rouverte`);
            } else {
                // Check required subtasks logic
                const can = typeof canCompleteTask === 'function' ? canCompleteTask(card) : { ok:true };
                if(!can.ok) {
                    showToast(`Tâche bloquée : ${can.count} sous-tâche(s) requise(s) manquante(s)`);
                    // Optionally open task to show
                    showTaskSummary(card.id);
                    return;
                }
                card.columnId = completedCol.id;
                card.completedAt = new Date().toISOString();
                // Handle recurrence
                if(typeof handleRecurrenceOnCompletion === 'function') handleRecurrenceOnCompletion(card);
                showToast(`Tâche “${card.title}” terminée ✓`);
                // Résumé de tâche s'active automatiquement
                setTimeout(()=>{ try{ showTaskSummary(card.id); }catch(e){} }, 180);
            }
            saveState();
            renderBoard();
            updateStats();
            renderNotesBlocks();
            // Also update badge counts
            refreshTaskEmbeds();
        }

        function refreshTaskEmbeds() {
            if(currentNoteId==null) return;
            // Re-render only if current note has task blocks
            const note = state.notes.find(n=>n.id===currentNoteId);
            if(note && note.blocks.some(b=>b.type==='task')) {
                renderNotesBlocks();
            }
        }
        // Hook into card updates to refresh embeds
        (function hookCardUpdates(){
            const toWrap = ['updateCard','createCard','executeDeleteCard','completeTask','deleteCard'];
            toWrap.forEach(fnName=>{
                const orig = window[fnName];
                if(typeof orig === 'function') {
                    window[fnName] = function(...args){
                        const res = orig.apply(this, args);
                        // Defer refresh to allow state to be saved
                        setTimeout(refreshTaskEmbeds, 80);
                        return res;
                    };
                }
            });
            // Also hook saveState to refresh embeds after any save that might be from board drag
            const origSave = window.saveState;
            if(typeof origSave === 'function') {
                window.saveState = function(...args){
                    const r = origSave.apply(this,args);
                    setTimeout(refreshTaskEmbeds, 120);
                    return r;
                };
            }
            // Hook renderBoard to also refresh
            const origRender = window.renderBoard;
            if(typeof origRender === 'function') {
                window.renderBoard = function(...args){
                    const r = origRender.apply(this,args);
                    // after board render, refresh notes if needed
                    setTimeout(()=> {
                        if(currentView==='notes') refreshTaskEmbeds();
                    }, 100);
                    return r;
                };
            }
        })();

        // Enhance block add bar to include quick task creation
        (function enhanceNoteAddBar(){
            document.addEventListener('DOMContentLoaded', ()=>{
                // Add a quick task button next to "Ajouter un bloc" if not exists
                setTimeout(()=>{
                    const bar = document.querySelector('.notes-add-bar');
                    if(bar && !bar.querySelector('[data-quick-task]')) {
                        const btn = document.createElement('button');
                        btn.setAttribute('data-quick-task','1');
                        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M9 14l2 2 4-4"/></svg> Nouvelle tâche rapide`;
                        btn.title = "Créer une tâche Kanban depuis la note";
                        btn.onclick = () => {
                            if(currentNoteId==null) { createNewNote(); setTimeout(()=> createQuickTaskFromNote(), 400); }
                            else createQuickTaskFromNote();
                        };
                        bar.insertBefore(btn, bar.firstChild);
                    }
                }, 600);
            });
        })();
        // === Notes -> Kanban : même dialogue que le Kanban ===
        let _notesPendingEmbed = null; // { blockId: string|null, mode: 'quick' }
        function openKanbanTaskModalForNote(blockId, hintTitle) {
            // Mémorise le bloc cible (ou null pour création rapide en fin de note)
            _notesPendingEmbed = { blockId: blockId || null, hint: hintTitle || '' };
            const todayCol = (typeof findColumnByRole==='function' ? findColumnByRole('today') : null) || (typeof isTodayColumn==='function' ? state.columns.find(isTodayColumn) : null) || state.columns[0];
            if (!todayCol) { showToast('Colonne introuvable'); return; }
            // Ferme le picker si ouvert
            const picker = document.getElementById('task-picker-modal');
            if (picker) closeTaskPickerModal();
            showAddCardModal(todayCol.id, 'quick');
            // Pré-remplir le titre avec le contenu du bloc ou le hint (synchrone pour tests + asynchrone pour UX)
            const syncInput = document.getElementById('card-title');
            if (syncInput) {
                if (hintTitle) {
                    syncInput.value = hintTitle.substring(0,120);
                    syncInput.dispatchEvent(new Event('input'));
                    if (typeof validateTitle==='function') try{validateTitle();}catch(e){}
                }
                try{ syncInput.focus(); }catch(e){}
            }
            setTimeout(()=>{
                const input = document.getElementById('card-title');
                if (input && hintTitle && !input.value) {
                    input.value = hintTitle.substring(0,120);
                    input.dispatchEvent(new Event('input'));
                    if (typeof validateTitle==='function') try{validateTitle();}catch(e){}
                }
                if (input) try{ input.focus(); }catch(e){}
            }, 120);
        }
        function createQuickTaskFromNote() {
            if (currentNoteId==null) { createNewNote(); setTimeout(()=> createQuickTaskFromNote(), 500); return; }
            const note = state.notes.find(n=>n.id===currentNoteId);
            // Si un bloc est focus, utilise son contenu comme hint, sinon vide
            let hint = '';
            const focused = document.activeElement?.closest('.note-block');
            if (focused) {
                const bid = focused.dataset.blockId;
                const b = note?.blocks.find(x=>x.id===bid);
                if (b && b.content) hint = b.content.trim();
            }
            openKanbanTaskModalForNote(null, hint);
        }

        // Expose for debugging and for inline handlers
        window.showTaskPickerForBlock = showTaskPickerForBlock;
        window.relinkTaskBlock = relinkTaskBlock;
        window.createTaskFromBlock = createTaskFromBlock;
        window.toggleTaskEmbedCheck = toggleTaskEmbedCheck;
        window.createQuickTaskFromNote = createQuickTaskFromNote;
        window.embedTaskInCurrentBlock = embedTaskInCurrentBlock;

        console.log('Task ↔ Notes sync prêt — tape @ ou / puis Tâche liée');

        // =========== START APP ============
        window.vnLegacy = {
            snapshot: () => ({data: JSON.parse(JSON.stringify(state)), archive: JSON.parse(JSON.stringify(archive))}),
            load: (payload) => { applyDatabasePayload(payload.data); archive = payload.archive || []; },
            start: () => { document.getElementById('sync-overlay')?.remove(); startApp(); document.dispatchEvent(new Event('DOMContentLoaded')); },
            render: () => { renderBoard(); updateStats(); if (currentView === 'calendar') renderCalendar(); },
            initial: () => ({data: cloneData(EMBEDDED_KANBAN_DATA), archive: []})
        };
        initTheme();
        updateHeaderClock();
        setInterval(updateHeaderClock, 1000);

