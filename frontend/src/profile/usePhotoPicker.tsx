'use client'

import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { PhotoCropper } from './PhotoCropper'
import { useAvatar } from './useProfile'

/** The hidden file input behind "change photo", the cropper it opens, and what it is doing. */
export function usePhotoPicker() {
  const input = useRef<HTMLInputElement>(null)
  const avatar = useAvatar()
  const [file, setFile] = useState<File | null>(null)
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0]
    // So picking the same file again still counts as a change.
    event.target.value = ''
    if (picked) setFile(picked)
  }
  const field: ReactNode = (
    <>
      <input ref={input} type="file" accept="image/*" hidden onChange={onChange} />
      {file && (
        <PhotoCropper
          file={file}
          onCancel={() => setFile(null)}
          onDone={(crop) => {
            avatar.mutate({ file, crop })
            setFile(null)
          }}
        />
      )}
    </>
  )
  return { pick: () => input.current?.click(), remove: () => avatar.mutate(null), field, avatar }
}
