import { createClient } from '@supabase/supabase-js'
import Sortable from 'sortablejs'
import legacySource from './legacy/app.js?raw'

window.Sortable = Sortable
// Public browser key only. Authorization is enforced by Supabase RLS.
const db = createClient(import.meta.env.VITE_SUPABASE_URL || 'https://unqfifaiywxuoqqtunya.supabase.co', import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Edxk7DifMOT8AB2FAV3CyQ_eDzsv14Y')
const auth = document.getElementById('cloud-auth')
const toolbar = document.getElementById('cloud-toolbar')
let user, revision = 0, dirty = false, saving = false, timer, started = false, conflict = false, generation = 0
const urls = new Map()
const status = (text, retry = false) => {
  document.getElementById('cloud-status').textContent = text
  document.getElementById('cloud-retry').hidden = !retry
}
const escape = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const cacheKey = () => `vn-cloud-pending:${user.id}`
function backup() {
  try { localStorage.setItem(cacheKey(), JSON.stringify({ ...window.vnLegacy.snapshot(), revision })) }
  catch { status('Stockage local indisponible — gardez cet onglet ouvert', true) }
}
window.vnQueueSave = () => {
  if (!started) return
  dirty = true
  generation++
  backup()
  status(conflict ? 'Conflit : exportez la copie locale avant de recharger' : 'Modifications en attente…', conflict)
  clearTimeout(timer)
  timer = setTimeout(save, 650)
}
async function save() {
  if (!dirty || saving || conflict || !user) return
  saving = true
  const version = generation
  const payload = window.vnLegacy.snapshot()
  try {
    status('Synchronisation…')
    const { data, error } = await db.from('vn_workspaces').update({ ...payload, revision: revision + 1, updated_at: new Date().toISOString() }).eq('user_id', user.id).eq('revision', revision).select('revision').maybeSingle()
    if (error) throw error
    if (!data) { conflict = true; throw new Error('Modifications sur un autre appareil. Exportez votre copie puis rechargez.') }
    revision = data.revision
    dirty = generation !== version
    if (dirty) backup()
    else localStorage.removeItem(cacheKey())
    status(dirty ? 'Modifications en attente…' : 'Synchronisé avec Supabase')
  } catch (error) { status(error.message || 'Échec réseau : copie locale conservée', true) }
  finally { saving = false; if (dirty && !conflict) { clearTimeout(timer); timer = setTimeout(save, 10000) } }
}
document.getElementById('cloud-retry').onclick = () => {
  if (!conflict) { save(); return }
  const blob = new Blob([JSON.stringify(window.vnLegacy.snapshot(), null, 2)], {type:'application/json'})
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'vn-copie-locale.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  if (confirm('Copie exportée. Charger maintenant la version Supabase ? Vos modifications locales resteront dans le fichier exporté.')) { localStorage.removeItem(cacheKey()); location.reload() }
}
document.getElementById('cloud-logout').onclick = async () => {
  if (dirty) { await save(); if (dirty && !confirm('Des modifications ne sont pas encore synchronisées. Elles resteront sauvegardées sur cet appareil. Se déconnecter ?')) return }
  const {error} = await db.auth.signOut()
  if (error) { status(error.message, true); return }
  location.reload()
}
window.addEventListener('beforeunload', e => { if (dirty) { backup(); e.preventDefault(); e.returnValue = '' } })
window.addEventListener('online', save)

async function signPhotos(payload) {
  const paths = [...new Set((payload.data.cards || []).flatMap(c => (c.photos || []).map(p => p.path)))].filter(p => typeof p === 'string' && p.startsWith(`${user.id}/`))
  if (!paths.length) return
  const { data, error } = await db.storage.from('vn-task-images').createSignedUrls(paths, 86400)
  if (error) throw error
  for (const p of data || []) if (p.signedUrl) urls.set(p.path, p.signedUrl)
}
window.vnPhotoGallery = photos => `<div class="vn-photos">${photos.filter(p => urls.has(p.path)).map(p => `<a href="${escape(urls.get(p.path))}" target="_blank" rel="noopener"><img src="${escape(urls.get(p.path))}" alt="${escape(p.name || 'Photo de la tâche')}" loading="lazy"></a>`).join('')}</div>`
window.vnPhotoEditor = photos => `<div class="vn-photo-editor" data-photos="${escape(JSON.stringify(photos))}"><label>Photos de la description<input type="file" accept="image/jpeg,image/png,image/webp" multiple onchange="vnUploadPhotos(this)"></label><small>JPEG, PNG ou WebP · 9 Mo maximum · 12 photos par tâche. Cliquez sur une photo pour l’ouvrir.</small><div class="vn-photo-list">${photoList(photos)}</div><p role="status" class="vn-photo-message"></p></div>`
function photoList(photos) { return window.vnPhotoGallery(photos) + photos.map((p,i) => `<button type="button" onclick="vnRemovePhoto(this,${i})">Retirer ${escape(p.name || 'la photo')}</button>`).join('') }
window.vnDraftPhotos = () => JSON.parse(document.querySelector('#card-description')?.parentElement.querySelector('.vn-photo-editor')?.dataset.photos || '[]')
window.vnRemovePhoto = (button, index) => {
  const editor = button.closest('.vn-photo-editor'); const photos = JSON.parse(editor.dataset.photos); photos.splice(index, 1); editor.dataset.photos = JSON.stringify(photos); editor.querySelector('.vn-photo-list').innerHTML = photoList(photos)
}
window.vnUploadPhotos = async input => {
  const editor = input.closest('.vn-photo-editor'), message = editor.querySelector('.vn-photo-message')
  const photos = JSON.parse(editor.dataset.photos)
  input.disabled = true
  // Disable save while uploads are in progress (including inline modal buttons).
  const buttons = [...(editor.closest('.modal-overlay') || editor).querySelectorAll('button')]
  const enabled = buttons.filter(b => !b.disabled); enabled.forEach(b => b.disabled = true)
  try {
    for (const file of input.files) {
      if (photos.length >= 12) throw new Error('Maximum 12 photos par tâche.')
      if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 9437184) throw new Error('Choisissez une image JPEG, PNG ou WebP de moins de 9 Mo.')
      message.textContent = `Envoi de ${file.name}…`
      const path = `${user.id}/${crypto.randomUUID()}.${{ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp' }[file.type]}`
      const { error } = await db.storage.from('vn-task-images').upload(path, file, {contentType:file.type})
      if (error) throw error
      const { data, error: signError } = await db.storage.from('vn-task-images').createSignedUrl(path, 86400)
      if (signError) throw signError
      urls.set(path, data.signedUrl); photos.push({path, name:file.name})
      editor.dataset.photos = JSON.stringify(photos)
      editor.querySelector('.vn-photo-list').innerHTML = photoList(photos)
    }
    message.textContent = 'Photos ajoutées. Enregistrez la tâche pour les conserver.'
  } catch (error) { message.textContent = error.message }
  finally { input.disabled = false; input.value = ''; enabled.forEach(b => b.disabled = false) }
}

async function boot(session) {
  user = session.user
  window.vnUserId = user.id
  auth.innerHTML = '<div class="cloud-panel"><h1>VN</h1><p>Chargement de votre espace sécurisé…</p></div>'
  try {
    if (!window.vnLegacy) { const script = document.createElement('script'); script.textContent = legacySource; document.body.appendChild(script) }
    const result = await db.from('vn_workspaces').select('*').eq('user_id', user.id).maybeSingle()
    if (result.error) throw result.error
    let row = result.data
    if (!row) {
      const initial = window.vnLegacy.initial()
      const created = await db.from('vn_workspaces').insert({user_id:user.id,...initial}).select('*').single()
      if (created.error) throw created.error
      row = created.data
    }
    revision = row.revision
    const local = localStorage.getItem(cacheKey())
    let payload = row
    if (local) {
      const pending = JSON.parse(local)
      if (pending.revision === revision) { payload = pending; dirty = true }
      else { payload = pending; dirty = true; conflict = true }
    }
    await signPhotos(payload)
    window.vnLegacy.load(payload)
    started = true
    window.vnLegacy.start()
    auth.innerHTML = ''; document.body.classList.remove('locked'); toolbar.hidden = false
    if (conflict) status('Conflit : exportez la copie locale avant de recharger', true)
    else if (dirty) await save()
    else status('Synchronisé avec Supabase')
    setInterval(async () => {
      if (dirty || saving || conflict || document.querySelector('.modal-overlay')) return
      const version = generation
      const {data, error} = await db.from('vn_workspaces').select('*').eq('user_id', user.id).single()
      if (error) { status('Réseau indisponible — reconnexion automatique'); return }
      if (dirty || saving || generation !== version) return
      if (data.revision !== revision) {
        try { await signPhotos(data); if (dirty || saving || generation !== version) return; revision = data.revision; window.vnLegacy.load(data); window.vnLegacy.render() }
        catch { status('Impossible de charger les photos', true) }
      }
      status('Synchronisé avec Supabase')
    }, 10000)
  } catch (error) {
    auth.innerHTML = `<div class="cloud-panel"><h1>Chargement impossible</h1><p class="cloud-error">${escape(error.message)}</p><button onclick="location.reload()">Réessayer</button><button id="boot-logout">Déconnexion</button></div>`
    document.getElementById('boot-logout').onclick = async () => { await db.auth.signOut(); location.reload() }
  }
}
function showAuth(mode = 'login') {
  const signup = mode === 'signup', reset = mode === 'reset'
  auth.innerHTML = `<form class="cloud-panel"><span style="color:#0071e3;font-weight:700">VN · GESTION DE TÂCHES</span><h1>${signup ? 'Créer un compte' : reset ? 'Mot de passe oublié' : 'Heureux de vous retrouver'}</h1><p>Vos tâches, notes et photos, synchronisées dans votre espace privé.</p><label>E-mail<input name="email" type="email" autocomplete="email" required></label>${reset ? '' : `<label>Mot de passe<input name="password" type="password" ${signup ? 'minlength="8"' : ''} autocomplete="${signup?'new-password':'current-password'}" required></label>`}<p id="auth-message" role="status"></p><button type="submit">${signup ? 'Créer mon compte' : reset ? 'Envoyer le lien' : 'Se connecter'}</button><button type="button" id="auth-switch">${signup || reset ? 'Retour à la connexion' : 'Créer un compte'}</button>${!signup && !reset ? '<button type="button" id="auth-forgot">Mot de passe oublié ?</button>' : ''}</form>`
  document.getElementById('auth-switch').onclick = () => showAuth(signup || reset ? 'login' : 'signup')
  document.getElementById('auth-forgot')?.addEventListener('click', () => showAuth('reset'))
  auth.querySelector('form').onsubmit = async e => {
    e.preventDefault(); const form = e.target; const button = form.querySelector('[type=submit]'); button.disabled = true
    const message = document.getElementById('auth-message')
    try {
      const email = form.email.value.trim(), password = form.password?.value
      const response = reset ? await db.auth.resetPasswordForEmail(email, {redirectTo:location.origin}) : signup ? await db.auth.signUp({email,password,options:{emailRedirectTo:location.origin}}) : await db.auth.signInWithPassword({email,password})
      if (response.error) throw response.error
      if (response.data?.session) await boot(response.data.session)
      else message.textContent = reset ? 'Si ce compte existe, un lien vous a été envoyé.' : 'Vérifiez votre boîte mail pour confirmer votre compte.'
    } catch (error) { message.className = 'cloud-error'; message.textContent = error.message }
    finally { button.disabled = false }
  }
}
let recovery = location.hash.includes('type=recovery')
db.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') { recovery = true; showRecovery() }
  if (event === 'SIGNED_OUT' && started) location.reload()
})
function showRecovery() {
  auth.innerHTML = '<form class="cloud-panel"><h1>Nouveau mot de passe</h1><label>Mot de passe<input type="password" name="password" minlength="8" autocomplete="new-password" required></label><p role="status"></p><button type="submit">Enregistrer</button></form>'
  auth.querySelector('form').onsubmit = async e => { e.preventDefault(); const button=e.target.querySelector('button'); button.disabled=true; const {error}=await db.auth.updateUser({password:e.target.password.value}); if(error) {e.target.querySelector('p').textContent=error.message;button.disabled=false} else {history.replaceState(null,'',location.pathname);location.reload()} }
}
async function main() {
  showAuth()
  try { const {data,error} = await db.auth.getSession(); if(error) throw error; if(recovery) showRecovery(); else if(data.session) await boot(data.session) }
  catch(error) { document.getElementById('auth-message').textContent=error.message }
}
main()
