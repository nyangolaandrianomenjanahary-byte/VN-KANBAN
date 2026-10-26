import { useState } from 'react'
import { backend, isConfigured } from '../lib/backend'

const MESSAGES = {
  'Invalid login credentials': 'E-mail ou mot de passe incorrect.',
  'Email not confirmed': 'Confirmez votre adresse e-mail avant de vous connecter.',
  'User already registered': 'Un compte existe déjà avec cet e-mail.',
  'Password should be at least 6 characters':
    'Le mot de passe doit contenir au moins 6 caractères.',
  'Unable to validate email address: invalid format': 'Adresse e-mail invalide.',
  'Email rate limit exceeded':
    "Trop d'e-mails envoyés récemment. Patientez quelques minutes.",
}

function humanError(message = '') {
  return MESSAGES[message] || message || 'Une erreur inattendue est survenue.'
}

export default function AuthScreen() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (!isConfigured) return
    setBusy(true)
    setError('')
    setNotice('')

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await backend.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        })
        if (signUpError) throw signUpError
        if (!data.session) {
          setNotice(
            'Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.',
          )
          setMode('signin')
        }
      } else {
        const { error: signInError } = await backend.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (signInError) throw signInError
      }
    } catch (err) {
      setError(humanError(err.message))
    } finally {
      setBusy(false)
    }
  }

  async function resetPassword() {
    if (!email.trim()) {
      setError('Saisissez votre e-mail pour recevoir le lien de réinitialisation.')
      return
    }
    setBusy(true)
    setError('')
    const { error: resetError } = await backend.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })
    setBusy(false)
    if (resetError) setError(humanError(resetError.message))
    else setNotice('Lien de réinitialisation envoyé. Consultez votre boîte mail.')
  }

  return (
    <div className="auth-shell">
      <div className="auth-grid" aria-hidden="true" />
      <main className="auth-card">
        <header className="auth-brand">
          <span className="brand-mark">VN</span>
          <div>
            <h1>Kanban</h1>
            <p className="mono">Gestion de tâches · photos à l'appui</p>
          </div>
        </header>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            className={mode === 'signin' ? 'is-active' : ''}
            onClick={() => {
              setMode('signin')
              setError('')
              setNotice('')
            }}
          >
            Connexion
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={mode === 'signup' ? 'is-active' : ''}
            onClick={() => {
              setMode('signup')
              setError('')
              setNotice('')
            }}
          >
            Créer un compte
          </button>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && (
            <label className="field">
              <span>Nom complet</span>
              <input
                type="text"
                value={fullName}
                autoComplete="name"
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nyangola Andrianomenjanahary"
              />
            </label>
          )}

          <label className="field">
            <span>E-mail</span>
            <input
              type="email"
              required
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
            />
          </label>

          <label className="field">
            <span>Mot de passe</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6 caractères minimum"
            />
          </label>

          {error && <p className="alert alert-error">{error}</p>}
          {notice && <p className="alert alert-success">{notice}</p>}

          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Patientez…' : mode === 'signup' ? 'Créer mon espace' : 'Se connecter'}
          </button>

          {mode === 'signin' && (
            <button type="button" className="link-btn" onClick={resetPassword} disabled={busy}>
              Mot de passe oublié ?
            </button>
          )}
        </form>

        <p className="auth-foot mono">
          Vos tâches et vos photos sont enregistrées dans votre espace privé chiffré.
        </p>

        {!isConfigured && (
          <p className="alert alert-error">
            Configuration manquante : renseignez VITE_BACKEND_URL et VITE_BACKEND_KEY
            (variables d'environnement Vercel).
          </p>
        )}
      </main>
    </div>
  )
}
