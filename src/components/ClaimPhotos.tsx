import { useEffect, useRef, useState } from 'react'
import { Camera, ImageOff, RefreshCw } from 'lucide-react'
import { cn } from '../lib/cn'
import { useClaimPhotoUrls } from '../lib/useClaimPhotoUrls'
import { Modal } from './ui'

type Stage = 'Before' | 'After'

const captionClasses = 'text-[.68rem] font-extrabold uppercase tracking-[.06em] text-(--muted)'

export function ClaimPhotoPair({ beforePath, afterPath, afterPlaceholder = 'After photo pending' }: {
  beforePath: string
  afterPath?: string
  afterPlaceholder?: string
}) {
  const { urls, failed, refresh } = useClaimPhotoUrls([beforePath, afterPath])
  const [viewing, setViewing] = useState<Stage | null>(null)
  // An image that fails to load gets one fresh URL (it may have expired), then a fallback.
  const [retried, setRetried] = useState<string[]>([])
  const [broken, setBroken] = useState<string[]>([])
  const tiles: { stage: Stage; path?: string }[] = [
    { stage: 'Before', path: beforePath },
    { stage: 'After', path: afterPath },
  ]
  const urlFor = (stage: Stage) => {
    const path = stage === 'Before' ? beforePath : afterPath
    return path && !broken.includes(path) ? urls[path] : undefined
  }
  const onImageError = (path: string) => {
    if (retried.includes(path)) setBroken(current => [...current, path])
    else {
      setRetried(current => [...current, path])
      refresh(path)
    }
  }
  const viewable = tiles.filter(tile => urlFor(tile.stage))

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map(tile => {
          const url = urlFor(tile.stage)
          return (
            <figure key={tile.stage} className="m-0 grid gap-1">
              {url && tile.path ? (
                <button
                  type="button"
                  className="group relative block aspect-[4/3] w-full overflow-hidden rounded-lg border border-(--line) bg-(--sage-2) p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--forest)"
                  aria-label={`View the ${tile.stage.toLowerCase()} photo full size`}
                  onClick={() => setViewing(tile.stage)}
                >
                  <img className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" src={url} alt="" onError={() => onImageError(tile.path!)} />
                </button>
              ) : (
                <span className="grid aspect-[4/3] w-full place-items-center rounded-lg border border-dashed border-(--line-strong) bg-(--surface-strong) px-2 text-center text-[.7rem] text-(--muted)">
                  {!tile.path
                    ? afterPlaceholder
                    : failed || broken.includes(tile.path)
                      ? <span className="inline-flex items-center gap-1"><ImageOff size={14} /> Photo unavailable</span>
                      : 'Loading photo…'}
                </span>
              )}
              <figcaption className={captionClasses}>{tile.stage}</figcaption>
            </figure>
          )
        })}
      </div>
      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title="Chore photos" className="w-[min(860px,100%)]">
        {viewing && (
          <div className="grid gap-3">
            {viewable.length > 1 && (
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-(--line) bg-(--surface) p-1" role="group" aria-label="Choose a photo">
                {viewable.map(tile => (
                  <button
                    key={tile.stage}
                    type="button"
                    aria-pressed={viewing === tile.stage}
                    onClick={() => setViewing(tile.stage)}
                    className={cn(
                      'min-h-10 rounded-lg border-0 bg-transparent text-[.8rem] font-[750] text-(--muted) transition-colors hover:text-(--ink) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--forest)',
                      viewing === tile.stage && 'bg-(--surface-strong)! text-(--ink)! shadow-[0_0_0_1px_var(--line-strong)]',
                    )}
                  >
                    {tile.stage}
                  </button>
                ))}
              </div>
            )}
            {urlFor(viewing) && <img className="max-h-[70vh] w-full rounded-lg object-contain" src={urlFor(viewing)} alt={`${viewing} photo of the chore`} />}
          </div>
        )}
      </Modal>
    </>
  )
}

/** Opens the rear camera on phones and falls back to a file picker elsewhere. */
export function PhotoCapture({ label, hint, caption, file, onChange, disabled, compact = false }: {
  label: string
  hint: string
  caption?: string
  file: File | null
  onChange: (file: File | null) => void
  disabled?: boolean
  compact?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  const open = () => inputRef.current?.click()

  return (
    <figure className="m-0 grid gap-1.5">
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept="image/*"
        capture="environment"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        onChange={event => {
          onChange(event.target.files?.[0] ?? null)
          event.target.value = ''
        }}
      />
      {preview ? (
        <div className="relative overflow-hidden rounded-xl border border-(--line) bg-(--sage-2)">
          <img className="aspect-[4/3] w-full object-cover" src={preview} alt={caption ? `Your ${caption.toLowerCase()} photo` : 'Your photo'} />
          <button
            type="button"
            disabled={disabled}
            onClick={open}
            aria-label={`Retake: ${label.toLowerCase()}`}
            className="absolute right-2 bottom-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg border-0 bg-(--surface-strong) px-3 text-[.76rem] font-[750] text-(--ink) shadow-[0_4px_14px_rgba(18,32,28,.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--forest) disabled:opacity-56"
          >
            <RefreshCw size={14} /> Retake
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={open}
          className="grid aspect-[4/3] max-h-[min(40vh,300px)] w-full content-center justify-items-center gap-2 rounded-xl border-2 border-dashed border-(--line-strong) bg-(--surface) px-3 text-center font-sans text-(--muted) transition-colors hover:border-(--forest-2) hover:bg-(--sage-2) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--forest) disabled:opacity-56"
        >
          <span className={cn('grid place-items-center rounded-full bg-(--green-soft) text-(--green)', compact ? 'size-9' : 'size-11')}><Camera size={compact ? 18 : 20} /></span>
          <strong className="text-[.84rem] leading-snug text-(--ink)">{label}</strong>
          <span className={cn('max-w-60 text-[.74rem] leading-snug font-normal text-(--muted)', compact && 'max-[520px]:hidden')}>{hint}</span>
        </button>
      )}
      {caption && <figcaption className={captionClasses}>{caption}</figcaption>}
    </figure>
  )
}
