import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { LibraryImage } from '../types';
import { useApp } from '../ui/AppContext';
import { Bar, Dialog } from '../ui/rd';

/**
 * Choose the hero image for one email, from the library or from a file.
 *
 * A grid rather than a list, because the thing being chosen is a picture and a
 * dropdown of filenames asks somebody to remember what "Studio — signing"
 * looks like. The tile IS the answer: it carries the picture where there is
 * one, and the system's "nothing here yet" hatch where there is not.
 *
 * **There is no "use the master's image" tile.** The owner, 28 Aug 2026: "For
 * the image selection, it shouldn't have a default." Picking one is the job,
 * so the picker offers only pictures — an unpicked slot has no tile wearing
 * `on`, which is the honest drawing of nothing chosen.
 *
 * Phase 1's seeded names have no file behind them: they are the names HubSpot
 * holds pictures for, and we do not hold the files. Those draw the hatch with
 * their name on it rather than pretending. Anything uploaded here is a real
 * image and shows. Phase 2 replaces the whole library with HubSpot's own.
 */
export function ImagePicker({
  open,
  slotLabel,
  /** The name currently picked, or null when nothing has been chosen yet. */
  picked,
  onClose,
  onPick,
}: {
  open: boolean;
  slotLabel: string;
  picked: string | null;
  onClose: () => void;
  onPick: (imageName: string) => void;
}): ReactElement {
  const { data, showToast } = useApp();
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    void data.listImages().then((list) => {
      if (live) setImages(list);
    });
    return () => {
      live = false;
    };
  }, [open, data]);

  const upload = async (chosen: File | undefined) => {
    if (!chosen) return;
    if (!chosen.type.startsWith('image/')) {
      showToast('That file is not an image', true);
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read that file'));
        reader.readAsDataURL(chosen);
      });
      // The file's own name, without its extension — it is what the picker
      // and every send that uses it will be labelled with.
      const name = chosen.name.replace(/\.[a-z0-9]+$/i, '');
      const list = await data.addImage(name, dataUrl);
      setImages(list);
      const added = list[list.length - 1];
      onPick(added.name);
      showToast(`${added.name} uploaded and set`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setUploading(false);
      if (file.current) file.current.value = '';
    }
  };

  return (
    <Dialog
      open={open}
      size="lg"
      onClose={onClose}
      title={`Image for ${slotLabel}`}
      /* "Done" rather than "Close": the dialogue already has a × labelled
         Close, and two controls with one name is one name too many for anyone
         reading the screen rather than looking at it. It is also the truer
         word — picking a tile applies immediately, so this is the end of the
         job rather than an escape from it. */
      secondary={{ label: 'Done', onClick: onClose }}
    >
      <div className="rd-imggrid">
        {images.map((img) => (
          <button
            key={img.name}
            type="button"
            className={picked === img.name ? 'rd-imgtile on' : 'rd-imgtile'}
            onClick={() => onPick(img.name)}
          >
            {img.url ? (
              <img className="rd-imgart" src={img.url} alt="" />
            ) : (
              <span className="rd-imgart rd-imgart-hatch" aria-hidden />
            )}
            <span className="rd-imgname">{img.name}</span>
          </button>
        ))}
      </div>

      <label className="rd-importdrop">
        {uploading ? 'Reading the file…' : 'Upload an image, or drop one here'}
        <input
          ref={file}
          type="file"
          accept="image/*"
          onChange={(e) => void upload(e.target.files?.[0])}
        />
      </label>

      <Bar tone="note" title="The hatched tiles have no picture to show yet">
        Those names live in HubSpot's own library, so there is no file here to draw — anything you
        upload shows its picture.
      </Bar>
    </Dialog>
  );
}
