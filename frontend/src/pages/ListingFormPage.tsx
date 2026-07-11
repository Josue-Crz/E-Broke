import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ImagePlus,
  LoaderCircle,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '../components/StatePanel'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api, ApiError, authRedirectFor, friendlyError } from '../lib/api'
import {
  categories,
  categoryLabel,
  conditions,
  conditionLabel,
  DEFAULT_IMAGE,
} from '../lib/constants'
import { mapPhotoCategory, mapPhotoCondition } from '../lib/photoAnalysis'
import type {
  Category,
  Condition,
  Listing,
  ListingInput,
  PhotoAnalysis,
} from '../types'

interface ListingFormState {
  title: string
  description: string
  category: Category
  condition: Condition
  neighborhood: string
  photoUrls: string[]
}

interface FormErrors {
  title?: string
  description?: string
  neighborhood?: string
  photoUrl?: string
  confirmation?: string
  freeOnly?: string
  form?: string
}

type AnalysisStatus = 'idle' | 'loading' | 'ready' | 'flagged' | 'error'

const EMPTY_FORM: ListingFormState = {
  title: '',
  description: '',
  category: 'dorm_essentials',
  condition: 'good',
  neighborhood: '',
  photoUrls: [],
}

function validHostedImageUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function exactCategory(value: string): Category | null {
  const normalized = value.trim().toLowerCase().replace(/[ -]+/g, '_')
  return categories.find((category) => category.value === normalized)?.value ?? null
}

function exactCondition(value: string): Condition | null {
  const normalized = value.trim().toLowerCase().replace(/[ -]+/g, '_')
  return conditions.find((condition) => condition.value === normalized)?.value ?? null
}

function imageFallback(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.onerror = null
  event.currentTarget.src = DEFAULT_IMAGE
}

export function ListingFormPage() {
  const { id } = useParams<{ id?: string }>()
  const editing = id !== undefined
  const listingId = id === undefined ? null : Number(id)
  const validId = !editing || (Number.isInteger(listingId) && Number(listingId) > 0)
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [form, setForm] = useState<ListingFormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(editing && validId)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [ownerId, setOwnerId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [photoUrlInput, setPhotoUrlInput] = useState('')
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null)
  const [uploadNotice, setUploadNotice] = useState<string | null>(null)

  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('idle')
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analysisConfirmed, setAnalysisConfirmed] = useState(false)
  const [mappedCategory, setMappedCategory] = useState<Category | null>(null)
  const [mappedCondition, setMappedCondition] = useState<Condition | null>(null)

  useEffect(() => {
    if (!editing) {
      setLoading(false)
      return
    }
    if (!validId || listingId === null) {
      setLoading(false)
      setLoadError('That listing address is not valid.')
      return
    }

    let current = true
    setLoading(true)
    setLoadError(null)
    api<{ listing: Listing }>(`/listings/${listingId}`)
      .then(({ listing }) => {
        if (!current) return
        setOwnerId(listing.userId)
        setForm({
          title: listing.title,
          description: listing.description,
          category: listing.category,
          condition: listing.condition,
          neighborhood: listing.neighborhood ?? '',
          photoUrls: listing.photoUrls,
        })
      })
      .catch((error: unknown) => {
        if (!current) return
        setLoadError(
          error instanceof ApiError && error.status === 404
            ? 'This listing is no longer available to edit.'
            : friendlyError(error),
        )
      })
      .finally(() => {
        if (current) setLoading(false)
      })

    return () => {
      current = false
    }
  }, [editing, listingId, loadAttempt, validId])

  useEffect(() => {
    if (!selectedFile || typeof URL.createObjectURL !== 'function') {
      setLocalPreview(null)
      return
    }
    const preview = URL.createObjectURL(selectedFile)
    setLocalPreview(preview)
    return () => URL.revokeObjectURL(preview)
  }, [selectedFile])

  const redirectForAuthError = (error: unknown): boolean => {
    const redirect = authRedirectFor(error)
    if (!redirect) return false
    navigate(redirect, {
      state: { from: `${location.pathname}${location.search}` },
    })
    return true
  }

  function updateField<K extends keyof ListingFormState>(field: K, value: ListingFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({
      ...current,
      [field]: undefined,
      freeOnly: field === 'title' || field === 'description' || field === 'neighborhood'
        ? undefined
        : current.freeOnly,
      form: undefined,
    }))
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErrors((current) => ({ ...current, photoUrl: 'Choose an image file.' }))
      event.target.value = ''
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrors((current) => ({ ...current, photoUrl: 'Choose an image smaller than 10 MB.' }))
      event.target.value = ''
      return
    }

    setSelectedFile(file)
    setUploadedPhotoUrl(null)
    setUploadNotice(null)
    setErrors((current) => ({ ...current, photoUrl: undefined, form: undefined }))
    setAnalysisStatus('idle')
    setAnalysis(null)
    setAnalysisError(null)
    setAnalysisConfirmed(false)
    setMappedCategory(null)
    setMappedCondition(null)
  }

  function addHostedPhoto() {
    const url = photoUrlInput.trim()
    if (!url) {
      setErrors((current) => ({ ...current, photoUrl: 'Enter a hosted image URL first.' }))
      return
    }
    if (!validHostedImageUrl(url)) {
      setErrors((current) => ({ ...current, photoUrl: 'Enter a complete http:// or https:// image URL.' }))
      return
    }
    if (form.photoUrls.includes(url)) {
      setPhotoUrlInput('')
      setErrors((current) => ({ ...current, photoUrl: undefined }))
      return
    }
    if (form.photoUrls.length >= 6) {
      setErrors((current) => ({ ...current, photoUrl: 'A listing can include up to six photos.' }))
      return
    }
    updateField('photoUrls', [...form.photoUrls, url])
    setPhotoUrlInput('')
  }

  function removePhoto(url: string) {
    updateField('photoUrls', form.photoUrls.filter((photo) => photo !== url))
    if (uploadedPhotoUrl === url) setUploadedPhotoUrl(null)
  }

  async function analyzePhoto() {
    if (!selectedFile || analysisStatus === 'loading') {
      if (!selectedFile) setErrors((current) => ({ ...current, photoUrl: 'Choose a photo for the AI helper first.' }))
      return
    }

    setAnalysisStatus('loading')
    setAnalysis(null)
    setAnalysisError(null)
    setAnalysisConfirmed(false)
    setErrors((current) => ({ ...current, confirmation: undefined }))

    const body = new FormData()
    body.append('photo', selectedFile)
    try {
      const result = await api<PhotoAnalysis>('/listings/analyze-photo', {
        method: 'POST',
        body,
      })
      setAnalysis(result)

      if (result.flagged || !result.isFree) {
        setAnalysisStatus('flagged')
        setMappedCategory(null)
        setMappedCondition(null)
        return
      }

      const nextCategory = mapPhotoCategory(result.category) ?? exactCategory(result.category)
      const nextCondition = mapPhotoCondition(result.condition) ?? exactCondition(result.condition)
      setMappedCategory(nextCategory)
      setMappedCondition(nextCondition)
      setForm((current) => ({
        ...current,
        title: result.title,
        description: result.description,
        category: nextCategory ?? current.category,
        condition: nextCondition ?? current.condition,
      }))
      setErrors((current) => ({
        ...current,
        title: undefined,
        description: undefined,
        freeOnly: undefined,
        form: undefined,
      }))
      setAnalysisStatus('ready')
    } catch (error) {
      if (redirectForAuthError(error)) return
      setAnalysisError(friendlyError(error))
      setAnalysisStatus('error')
    }
  }

  function validate(): FormErrors {
    const next: FormErrors = {}
    const title = form.title.trim()
    const description = form.description.trim()
    const neighborhood = form.neighborhood.trim()
    const pendingPhotoUrl = photoUrlInput.trim()

    if (title.length < 3) next.title = 'Use at least 3 characters for the title.'
    else if (title.length > 120) next.title = 'Keep the title to 120 characters or fewer.'
    if (description.length < 10) next.description = 'Share at least 10 characters about the item.'
    else if (description.length > 2000) next.description = 'Keep the description to 2,000 characters or fewer.'
    if (neighborhood.length > 120) next.neighborhood = 'Keep the pickup area to 120 characters or fewer.'
    if (pendingPhotoUrl && !validHostedImageUrl(pendingPhotoUrl)) {
      next.photoUrl = 'Enter a complete http:// or https:// image URL.'
    }
    const pendingPhotoCount = form.photoUrls.length + (pendingPhotoUrl && !form.photoUrls.includes(pendingPhotoUrl) ? 1 : 0)
    if (pendingPhotoCount > 6 || (selectedFile && !uploadedPhotoUrl && pendingPhotoCount >= 6)) {
      next.photoUrl = 'A listing can include up to six photos.'
    }
    if (analysisStatus === 'ready' && !analysisConfirmed) {
      next.confirmation = 'Review the AI suggestions and confirm them before posting.'
    }
    return next
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    if (editing && ownerId !== null && user && ownerId !== user.id) {
      setErrors({ form: 'Only the Gator who posted this item can edit it.' })
      return
    }

    const nextErrors = validate()
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSubmitting(true)
    setErrors({})
    setUploadNotice(null)

    const photoUrls = [...form.photoUrls]
    const pendingPhotoUrl = photoUrlInput.trim()
    if (pendingPhotoUrl && !photoUrls.includes(pendingPhotoUrl)) photoUrls.push(pendingPhotoUrl)

    if (selectedFile && !uploadedPhotoUrl) {
      const uploadBody = new FormData()
      uploadBody.append('photo', selectedFile)
      try {
        const uploaded = await api<{ url: string }>('/uploads/photo', {
          method: 'POST',
          body: uploadBody,
        })
        if (!photoUrls.includes(uploaded.url)) photoUrls.push(uploaded.url)
        setUploadedPhotoUrl(uploaded.url)
      } catch (error) {
        if (redirectForAuthError(error)) {
          setSubmitting(false)
          return
        }
        if (error instanceof ApiError && error.code === 'SPACES_NOT_CONFIGURED') {
          const notice = pendingPhotoUrl
            ? 'Local photo storage is unavailable, so the hosted photo URL will be used.'
            : 'Local photo storage is unavailable. You can continue with the default image or add a hosted photo URL.'
          setUploadNotice(notice)
          showToast(notice, 'info')
        } else {
          setErrors({ form: `The photo could not be uploaded. ${friendlyError(error)}` })
          setSubmitting(false)
          return
        }
      }
    } else if (uploadedPhotoUrl && !photoUrls.includes(uploadedPhotoUrl)) {
      photoUrls.push(uploadedPhotoUrl)
    }

    const payload: ListingInput = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      condition: form.condition,
      ...(editing || form.neighborhood.trim()
        ? { neighborhood: form.neighborhood.trim() }
        : {}),
      photoUrls,
    }

    try {
      const result = await api<{ listing: Listing }>(
        editing ? `/listings/${listingId}` : '/listings',
        {
          method: editing ? 'PATCH' : 'POST',
          body: payload,
        },
      )
      showToast(editing ? 'Listing updated.' : 'Your free item is live!', 'success')
      navigate(`/listings/${result.listing.id}`)
    } catch (error) {
      if (redirectForAuthError(error)) return
      if (error instanceof ApiError && error.code === 'FREE_ONLY_VIOLATION') {
        setErrors({ freeOnly: error.message })
      } else {
        setErrors({ form: friendlyError(error) })
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="page page--listing-form">
        <div className="form-page-shell"><LoadingState message="Getting your listing ready…" /></div>
      </main>
    )
  }

  if (loadError || !validId) {
    return (
      <main className="page page--listing-form">
        <div className="form-page-shell">
          <ErrorState
            title="We could not open this listing"
            message={loadError ?? 'That listing address is not valid.'}
            action={
              <div className="state-panel__actions">
                {validId && (
                  <button className="button button--secondary" type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
                    Try again
                  </button>
                )}
                <Link className="button button--primary" to="/me/listings">My listings</Link>
              </div>
            }
          />
        </div>
      </main>
    )
  }

  if (editing && ownerId !== null && user && ownerId !== user.id) {
    return (
      <main className="page page--listing-form">
        <div className="form-page-shell">
          <ErrorState
            title="This listing belongs to another Gator"
            message="Only the person who posted it can change its details."
            action={<Link className="button button--primary" to={`/listings/${listingId}`}>View listing</Link>}
          />
        </div>
      </main>
    )
  }

  const preview = localPreview || uploadedPhotoUrl || form.photoUrls[0] || photoUrlInput.trim() || DEFAULT_IMAGE

  return (
    <main className="page page--listing-form">
      <div className="form-page-shell">
        <header className="form-page-header">
          <span className="eyebrow"><Sparkles size={16} /> Free-only marketplace</span>
          <h1>{editing ? 'Edit your listing' : 'Give something a new home'}</h1>
          <p>{editing ? 'Update the details below and save your changes.' : 'Share a useful item with another SFSU Gator.'}</p>
        </header>

        <form className="listing-form" onSubmit={handleSubmit} noValidate>
          {(errors.freeOnly || errors.form) && (
            <div className="form-alert form-alert--error" role="alert">
              <AlertTriangle aria-hidden="true" />
              <div>
                <strong>{errors.freeOnly ? 'e-Broke is free-only' : 'We could not save the listing'}</strong>
                <p>{errors.freeOnly ?? errors.form}</p>
              </div>
            </div>
          )}

          <section className="form-card photo-helper-card">
            <div className="form-card__heading">
              <div>
                <span className="step-label">Step 1</span>
                <h2>Add a photo</h2>
                <p>Choose an image, then let the AI helper draft the details if you want.</p>
              </div>
              <Bot aria-hidden="true" />
            </div>

            <div className="photo-helper">
              <div className="photo-preview">
                <img src={preview} alt="Listing preview" onError={imageFallback} />
                {analysisStatus === 'loading' && (
                  <span className="photo-preview__loading"><LoaderCircle className="spin" /> Analyzing…</span>
                )}
              </div>

              <div className="photo-helper__controls">
                <label className="file-picker" htmlFor="listing-photo">
                  <ImagePlus aria-hidden="true" />
                  <span>
                    <strong>{selectedFile ? 'Choose a different photo' : 'Choose a photo'}</strong>
                    <small>JPG, PNG, or WebP · up to 10 MB</small>
                  </span>
                </label>
                <input id="listing-photo" className="visually-hidden" type="file" accept="image/*" onChange={handleFileChange} />
                {selectedFile && <p className="selected-file-name">Selected: {selectedFile.name}</p>}
                <button
                  className="button button--accent"
                  type="button"
                  disabled={!selectedFile || analysisStatus === 'loading'}
                  onClick={analyzePhoto}
                >
                  {analysisStatus === 'loading' ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
                  {analysisStatus === 'loading' ? 'Analyzing photo…' : analysisStatus === 'error' || analysisStatus === 'flagged' ? 'Try AI analysis again' : 'Draft details with AI'}
                </button>
                <p className="helper-text">AI suggestions are optional. You always review them before posting.</p>
              </div>
            </div>

            {analysisStatus === 'ready' && analysis && (
              <div className="analysis-result analysis-result--success" role="status">
                <CheckCircle2 aria-hidden="true" />
                <div>
                  <strong>Draft ready — review the fields below</strong>
                  <p>
                    Suggested category: {mappedCategory ? categoryLabel(mappedCategory) : analysis.category} · condition:{' '}
                    {mappedCondition ? conditionLabel(mappedCondition) : analysis.condition}
                  </p>
                  {(!mappedCategory || !mappedCondition) && (
                    <p>The AI used a label that is not in the form, so choose the closest option yourself.</p>
                  )}
                  <label className="confirmation-check">
                    <input
                      type="checkbox"
                      checked={analysisConfirmed}
                      onChange={(event) => {
                        setAnalysisConfirmed(event.target.checked)
                        setErrors((current) => ({ ...current, confirmation: undefined }))
                      }}
                    />
                    I reviewed the AI suggestions and confirm the listing details.
                  </label>
                  {errors.confirmation && <p className="field-error" role="alert">{errors.confirmation}</p>}
                </div>
              </div>
            )}

            {analysisStatus === 'flagged' && analysis && (
              <div className="analysis-result analysis-result--warning" role="alert">
                <AlertTriangle aria-hidden="true" />
                <div>
                  <strong>The AI helper could not use this photo</strong>
                  <p>{analysis.flagReason || 'Choose another image, or fill in the listing details yourself.'}</p>
                  <p>No suggestions were applied.</p>
                </div>
              </div>
            )}

            {analysisStatus === 'error' && (
              <div className="analysis-result analysis-result--error" role="alert">
                <AlertTriangle aria-hidden="true" />
                <div>
                  <strong>The AI helper needs another try</strong>
                  <p>{analysisError ?? 'Please try again in a moment.'}</p>
                  <button className="text-button" type="button" onClick={analyzePhoto}>Retry analysis</button>
                </div>
              </div>
            )}

            <div className="hosted-photo-field">
              <label htmlFor="photo-url">Hosted photo URL <span>(optional fallback)</span></label>
              <div className="inline-input-action">
                <input
                  id="photo-url"
                  type="url"
                  value={photoUrlInput}
                  placeholder="https://example.com/item-photo.jpg"
                  aria-invalid={Boolean(errors.photoUrl)}
                  aria-describedby={errors.photoUrl ? 'photo-url-error' : 'photo-url-help'}
                  onChange={(event) => {
                    setPhotoUrlInput(event.target.value)
                    setErrors((current) => ({ ...current, photoUrl: undefined }))
                  }}
                />
                <button className="button button--secondary" type="button" onClick={addHostedPhoto}>Add URL</button>
              </div>
              <p className="helper-text" id="photo-url-help">Useful when local photo storage is unavailable. You can also continue with the default image.</p>
              {errors.photoUrl && <p className="field-error" id="photo-url-error" role="alert">{errors.photoUrl}</p>}
              {uploadNotice && <p className="form-notice" role="status">{uploadNotice}</p>}
            </div>

            {form.photoUrls.length > 0 && (
              <div className="photo-list" aria-label="Listing photos">
                {form.photoUrls.map((url, index) => (
                  <div className="photo-list__item" key={url}>
                    <img src={url} alt={`Listing photo ${index + 1}`} onError={imageFallback} />
                    <button type="button" aria-label={`Remove photo ${index + 1}`} onClick={() => removePhoto(url)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="form-card">
            <div className="form-card__heading">
              <div>
                <span className="step-label">Step 2</span>
                <h2>Describe the item</h2>
                <p>Clear, honest details help it reach the right person.</p>
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="listing-title">Title</label>
              <input
                id="listing-title"
                name="title"
                value={form.title}
                maxLength={120}
                required
                aria-invalid={Boolean(errors.title)}
                aria-describedby={errors.title ? 'listing-title-error' : 'listing-title-help'}
                onChange={(event) => updateField('title', event.target.value)}
              />
              <div className="field-hint-row">
                {errors.title ? <span className="field-error" id="listing-title-error" role="alert">{errors.title}</span> : <span id="listing-title-help">What would you search for?</span>}
                <span>{form.title.length}/120</span>
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="listing-description">Description</label>
              <textarea
                id="listing-description"
                name="description"
                value={form.description}
                maxLength={2000}
                rows={7}
                required
                aria-invalid={Boolean(errors.description)}
                aria-describedby={errors.description ? 'listing-description-error' : 'listing-description-help'}
                onChange={(event) => updateField('description', event.target.value)}
              />
              <div className="field-hint-row">
                {errors.description ? <span className="field-error" id="listing-description-error" role="alert">{errors.description}</span> : <span id="listing-description-help">Mention size, wear, included parts, and pickup notes.</span>}
                <span>{form.description.length}/2000</span>
              </div>
            </div>

            <fieldset className="choice-fieldset">
              <legend>Category</legend>
              <div className="choice-grid choice-grid--categories">
                {categories.map((category) => (
                  <label className={form.category === category.value ? 'choice-card choice-card--selected' : 'choice-card'} key={category.value}>
                    <input
                      type="radio"
                      name="category"
                      value={category.value}
                      checked={form.category === category.value}
                      onChange={() => updateField('category', category.value)}
                    />
                    <span aria-hidden="true">{category.emoji}</span>
                    <strong>{category.label}</strong>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="choice-fieldset">
              <legend>Condition</legend>
              <div className="choice-grid choice-grid--conditions">
                {conditions.map((condition) => (
                  <label className={form.condition === condition.value ? 'choice-card choice-card--selected' : 'choice-card'} key={condition.value}>
                    <input
                      type="radio"
                      name="condition"
                      value={condition.value}
                      checked={form.condition === condition.value}
                      onChange={() => updateField('condition', condition.value)}
                    />
                    <strong>{condition.label}</strong>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="field-group">
              <label htmlFor="listing-neighborhood">Pickup area <span>(optional)</span></label>
              <input
                id="listing-neighborhood"
                name="neighborhood"
                value={form.neighborhood}
                maxLength={120}
                placeholder="For example, Parkmerced or near campus"
                aria-invalid={Boolean(errors.neighborhood)}
                aria-describedby={errors.neighborhood ? 'listing-neighborhood-error' : 'listing-neighborhood-help'}
                onChange={(event) => updateField('neighborhood', event.target.value)}
              />
              {errors.neighborhood ? <p className="field-error" id="listing-neighborhood-error" role="alert">{errors.neighborhood}</p> : <p className="helper-text" id="listing-neighborhood-help">Keep the exact meetup location private until you connect.</p>}
            </div>
          </section>

          <div className="listing-form__actions">
            <Link className="button button--ghost" to={editing && listingId ? `/listings/${listingId}` : '/'}>Cancel</Link>
            <button className="button button--primary" type="submit" disabled={submitting}>
              {submitting ? <LoaderCircle className="spin" size={18} /> : <Upload size={18} />}
              {submitting ? (editing ? 'Saving…' : 'Posting…') : (editing ? 'Save changes' : 'Post free item')}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
