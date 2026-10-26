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

// Éditeur de photos minimaliste : une commande discrète, des vignettes, aucun texte natif.
const photoAddGlyph = '<svg class="vn-photo-add-glyph" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 8.2v7.6M8.2 12h7.6"></path></svg>'
const photoAddTile = () => `<label class="vn-photo-add" title="Ajouter des photos"><input type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="Ajouter des photos" onchange="vnUploadPhotos(this)">${photoAddGlyph}<span>Ajouter</span></label>`
function photoList(photos) {
  return photos.map((p, i) => {
    const url = urls.get(p.path)
    if (!url) return ''
    return `<figure class="vn-photo-thumb"><a class="vn-photo-open" href="${escape(url)}" target="_blank" rel="noopener" aria-label="Ouvrir la photo"><img src="${escape(url)}" alt="${escape(p.name || 'Photo de la tâche')}" loading="lazy"></a><button type="button" class="vn-photo-remove" onclick="vnRemovePhoto(this,${i})" title="Retirer la photo" aria-label="Retirer la photo"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></figure>`
  }).join('')
}
function renderPhotos(editor, photos) {
  if (!editor) return
  editor.dataset.photos = JSON.stringify(photos)
  editor.classList.toggle('has-photos', photos.length > 0)
  editor.classList.toggle('is-full', photos.length >= 12)
  const list = editor.querySelector('.vn-photo-list')
  if (list) list.innerHTML = photoList(photos)
}
window.vnPhotoEditor = photos => {
  const list = Array.isArray(photos) ? photos : []
  return `<div class="vn-photo-editor${list.length ? ' has-photos' : ''}${list.length >= 12 ? ' is-full' : ''}" data-photos="${escape(JSON.stringify(list))}" ondragover="vnDragPhotos(event,this)" ondragleave="vnDragPhotos(event,this,true)" ondrop="vnDropPhotos(event,this)"><div class="vn-photo-list">${photoList(list)}</div>${photoAddTile()}<p role="status" aria-live="polite" class="vn-photo-message"></p></div>`
}
window.vnDraftPhotos = () => JSON.parse(document.querySelector('#card-description')?.parentElement.querySelector('.vn-photo-editor')?.dataset.photos || '[]')
window.vnRemovePhoto = (button, index) => {
  const editor = button.closest('.vn-photo-editor')
  if (!editor) return
  const photos = JSON.parse(editor.dataset.photos || '[]')
  photos.splice(index, 1)
  renderPhotos(editor, photos)
}
window.vnDragPhotos = (event, editor, leaving = false) => {
  event.preventDefault()
  if (leaving) editor.classList.remove('is-drop')
  else editor.classList.add('is-drop')
}
window.vnDropPhotos = (event, editor) => {
  event.preventDefault()
  editor.classList.remove('is-drop')
  const files = Array.from(event.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'))
  if (files.length) uploadPhotos(editor, files)
}
async function uploadPhotos(editor, files) {
  if (!editor || !files.length) return
  const message = editor.querySelector('.vn-photo-message')
  const setMessage = (text, isError = false) => {
    if (!message) return
    message.textContent = text
    message.classList.toggle('is-error', isError)
  }
  const photos = JSON.parse(editor.dataset.photos || '[]')
  editor.classList.add('is-uploading')
  // Disable save while uploads are in progress (including inline modal buttons).
  const buttons = [...(editor.closest('.modal-overlay') || editor).querySelectorAll('button')]
  const enabled = buttons.filter(b => !b.disabled); enabled.forEach(b => b.disabled = true)
  try {
    for (const [i, file] of files.entries()) {
      if (photos.length >= 12) throw new Error('Maximum 12 photos par tâche.')
      if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 9437184) throw new Error('Choisissez une image JPEG, PNG ou WebP de moins de 9 Mo.')
      setMessage(files.length > 1 ? `Envoi ${i + 1}/${files.length}…` : 'Envoi…')
      const path = `${user.id}/${crypto.randomUUID()}.${{ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp' }[file.type]}`
      const { error } = await db.storage.from('vn-task-images').upload(path, file, {contentType:file.type})
      if (error) throw error
      const { data, error: signError } = await db.storage.from('vn-task-images').createSignedUrl(path, 86400)
      if (signError) throw signError
      urls.set(path, data.signedUrl); photos.push({path, name:file.name})
      renderPhotos(editor, photos)
    }
    // Succès silencieux : les vignettes suffisent, aucun message ne reste à l'écran.
    setMessage('')
  } catch (error) { setMessage(error.message, true) }
  finally { editor.classList.remove('is-uploading'); enabled.forEach(b => b.disabled = false) }
}
window.vnUploadPhotos = input => {
  const editor = input.closest('.vn-photo-editor')
  const files = Array.from(input.files || [])
  input.value = ''
  if (editor && files.length) uploadPhotos(editor, files)
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
