import { useEffect, useId, useState } from 'react'
import { Camera, ImageOff, RefreshCw } from 'lucide-react'
import { cn } from '../lib/cn'
import { useClaimPhotoUrls } from '../lib/useClaimPhotoUrls'
import { Modal } from './ui'

export function ClaimPhotoPair({ beforePath, afterPath, afterPlaceholder = 'After photo pending' }: {
  beforePath: string
  afterPath?: string
  afterPlaceholder?: string
}) {
  const { urls, failed } = useClaimPhotoUrls([beforePath, afterPath])
  const [viewing, setViewing] = useState<{ label: string; url: string } | null>(null)
  const tiles = [
    { label: 'Before', path: beforePath },
    { label: 'After', path: afterPath },
  ]
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map(tile => {
          const url = tile.path ? urls[tile.path] : undefined
          return (
            <figure key={tile.label} className="m-0 grid gap-1">
              {url ? (
                <button
                  type="button"
                  className="group relative block aspect-[4/3] w-full overflow-hidden rounded-lg border border-(--line) bg-(--sage-2) p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--forest)"
                  aria-label={`View the ${tile.label.toLowerCase()} photo`}
                  onClick={() => setViewing({ label: tile.label, url })}
                >
                  <img className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" src={url} alt="" />
                </button>
              ) : (
                <span className="grid aspect-[4/3] w-full place-items-center rounded-lg border border-dashed border-(--line-strong) bg-(--surface-strong) px-2 text-center text-[.7rem] text-(--muted)">
                  {tile.path
                    ? failed ? <span className="inline-flex items-center gap-1"><ImageOff size={14} /> Photo unavailable</span> : 'Loading photo…'
                    : afterPlaceholder}
                </span>
              )}
              <figcaption className="text-[.68rem] font-extrabold uppercase tracking-[.06em] text-(--muted)">{tile.label}</figcaption>
            </figure>
          )
        })}
      </div>
      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title={`${viewing?.label ?? ''} photo`} className="w-[min(860px,100%)]">
        {viewing && <img className="max-h-[70vh] w-full rounded-lg object-contain" src={viewing.url} alt={`${viewing.label} photo of the chore`} />}
      </Modal>
    </>
  )
}

/** Opens the rear camera on phones and falls back to a file picker elsewhere. */
export function PhotoCapture({ label, hint, file, onChange, disabled }: {
  label: string
  hint: string
  file: File | null
  onChange: (file: File | null) => void
  disabled?: boolean
}) {
  const inputId = useId()
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

  return (
    <div className="grid gap-1.5">
      <input
        id={inputId}
        className="hidden"
        type="file"
        accept="image/*"
        capture="environment"
        disabled={disabled}
        onChange={event => {
          onChange(event.target.files?.[0] ?? null)
          event.target.value = ''
        }}
      />
      {preview ? (
        <div className="relative overflow-hidden rounded-xl border border-(--line) bg-(--sage-2)">
          <img className="aspect-[4/3] w-full object-cover" src={preview} alt={`${label} preview`} />
          <label
            htmlFor={inputId}
            className={cn(
              'absolute right-2 bottom-2 inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-(--surface-strong) px-3 text-[.76rem] font-[750] text-(--ink) shadow-[0_4px_14px_rgba(18,32,28,.18)]',
              disabled && 'pointer-events-none opacity-56',
            )}
          >
            <RefreshCw size={14} /> Retake
          </label>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={cn(
            'grid aspect-[4/3] w-full cursor-pointer place-items-center content-center gap-2 rounded-xl border-2 border-dashed border-(--line-strong) bg-(--surface) px-4 text-center text-(--muted) transition-colors hover:border-(--forest-2) hover:bg-(--sage-2)',
            disabled && 'pointer-events-none opacity-56',
          )}
        >
          <span className="grid size-11 place-items-center rounded-full bg-(--green-soft) text-(--green)"><Camera size={20} /></span>
          <strong className="text-[.86rem] text-(--ink)">{label}</strong>
          <span className="max-w-60 text-[.74rem] leading-snug">{hint}</span>
        </label>
      )}
    </div>
  )
}
