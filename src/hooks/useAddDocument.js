// Adding a document to the Library, with a line saying how far it has got ("Reading page 12 of 212…")
import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { addToLibrary } from '../lib/library'

export function useAddDocument() {
  const [adding, setAdding] = useState('')   // progress while a document is being added
  const add = useCallback(async (file) => {
    setAdding('Opening…')
    try {
      const { doc, skipped } = await addToLibrary(file, setAdding)
      toast.success(`Added ${doc.name} to your Library`)
      if (skipped) toast(`Jarvis read the first 30 scanned pages; ${skipped} more were left out. Add those as a separate document.`, { duration: 8000 })
      return doc
    } catch (err) {
      toast.error(err.message || "Couldn't add it. Try again.", { duration: 7000 })
      return null
    } finally {
      setAdding('')
    }
  }, [])
  return { adding, add }
}
