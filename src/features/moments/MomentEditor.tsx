import { useEffect, useState } from "react";
import { PhotoEditor } from "@/features/camera/PhotoEditor";
import {
  aspectValue,
  defaultEditorDoc,
  frameForMode,
  type EditorDoc,
} from "@/features/camera/editorTypes";
import { composeImage } from "@/features/camera/editorCanvas";
import { useToast } from "@/hooks/useToast";
import { errorMessage } from "@/utils/errors";

export function MomentEditor({
  files,
  onDone,
}: {
  files: File[];
  onDone: (files: File[]) => void;
}) {
  const { toast } = useToast();
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<{ url: string; aspect: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<File[]>([]);

  const current = files[index];

  useEffect(() => {
    if (!current) return;
    const url = URL.createObjectURL(current);
    let live = true;
    const image = new Image();
    image.src = url;
    image
      .decode()
      .then(() => {
        if (live) {
          setStage({
            url,
            aspect:
              image.naturalWidth && image.naturalHeight
                ? `${image.naturalWidth}/${image.naturalHeight}`
                : "4/5",
          });
        }
      })
      .catch(() => {
        if (live) setStage({ url, aspect: "4/5" });
      });
    return () => {
      live = false;
      URL.revokeObjectURL(url);
    };
  }, [current]);

  async function finish(doc: EditorDoc) {
    if (!stage || busy) return;
    setBusy(true);
    try {
      const blob = await composeImage({
        url: stage.url,
        doc,
        aspect: aspectValue(stage.aspect),
      });
      const file = blob
        ? new File([blob], current.name.replace(/\.[^.]+$/, "-xelvic.jpg"), {
            type: "image/jpeg",
          })
        : current;
      const next = [...done, file];
      if (index + 1 < files.length) {
        setDone(next);
        setIndex(index + 1);
      } else {
        onDone(next);
      }
    } catch (error) {
      toast({ title: "That edit did not save", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (!stage || !current) return null;

  return (
    <div className="fixed inset-0 z-[95]">
      <PhotoEditor
        shot={{ url: stage.url, kind: "image" }}
        mode="moment"
        shotAspect={stage.aspect}
        initialDoc={{
          ...defaultEditorDoc(frameForMode("moment", stage.aspect)),
          frame: frameForMode("moment", stage.aspect),
          fit: true,
          panX: 0,
          panY: 0,
          zoom: 1,
        }}
        onCancel={() => onDone([...done, ...files.slice(index)])}
        onDone={(doc) => void finish(doc)}
      />
      {files.length > 1 ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-3 z-[110] text-center text-[11px] font-bold text-dim">
          Picture {index + 1} of {files.length}
        </p>
      ) : null}
      {busy ? (
        <div className="pointer-events-none absolute inset-0 z-[110] flex items-center justify-center bg-[color-mix(in_srgb,var(--ink)_35%,transparent)]">
          <span className="rounded-full bg-card px-4 py-2 text-[12px] font-bold text-ink">
            Saving...
          </span>
        </div>
      ) : null}
    </div>
  );
}

export default MomentEditor;
