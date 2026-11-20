import type { IconType } from "react-icons";
import {
  FaFile,
  FaFileAudio,
  FaFileCode,
  FaFileCsv,
  FaFileExcel,
  FaFileImage,
  FaFileLines,
  FaFilePdf,
  FaFilePowerpoint,
  FaFileVideo,
  FaFileWord,
  FaFileZipper,
} from "react-icons/fa6";

/**
 * The mark a file wears, by the kind of file it is.
 *
 * react-icons' own file set rather than one generic shape from the interface
 * set: a PDF, a spreadsheet, a clip and a zip have to be told apart at a
 * glance, which is the whole job of the glyph on a file row. The mime the
 * server kept answers first, because that is the fact; the name's own ending is
 * the fallback for a file whose type was never recorded.
 */
export function documentGlyph(
  mime?: string | null,
  name?: string | null,
): IconType {
  const type = String(mime ?? "").toLowerCase();
  const file = String(name ?? "").toLowerCase();
  const is = (pattern: RegExp, endings: RegExp) =>
    pattern.test(type) || endings.test(file);

  if (is(/pdf/, /\.pdf$/)) return FaFilePdf;
  if (
    is(
      /word|wordprocessingml|msword|opendocument\.text/,
      /\.(docx?|rtf|odt)$/,
    )
  )
    return FaFileWord;
  if (is(/excel|spreadsheetml|spreadsheet/, /\.(xlsx?|ods)$/))
    return FaFileExcel;
  if (is(/csv/, /\.csv$/)) return FaFileCsv;
  if (is(/presentation|powerpoint/, /\.(pptx?|odp|key)$/))
    return FaFilePowerpoint;
  if (
    is(
      /zip|compressed|x-7z|x-rar|gzip|x-tar/,
      /\.(zip|rar|7z|gz|tgz|tar)$/,
    )
  )
    return FaFileZipper;
  if (is(/^image\//, /\.(png|jpe?g|gif|webp|svg|heic|bmp|avif)$/))
    return FaFileImage;
  if (is(/^video\//, /\.(mp4|mov|m4v|webm|mkv|avi)$/)) return FaFileVideo;
  if (is(/^audio\//, /\.(mp3|wav|m4a|aac|ogg|opus|flac)$/)) return FaFileAudio;
  if (
    is(
      /json|javascript|ecmascript|xml|html|css|python|sql|yaml|x-sh/,
      /\.(json|jsx?|tsx?|py|rb|go|rs|java|c|cpp|cs|php|sql|xml|html?|css|scss|ya?ml|sh|ps1)$/,
    )
  )
    return FaFileCode;
  if (is(/^text\//, /\.(txt|md|log)$/)) return FaFileLines;
  return FaFile;
}

/** One file's own mark, for a row that names a file somebody sent. */
export function DocumentGlyph({
  mime,
  name,
  className,
}: {
  mime?: string | null;
  name?: string | null;
  className?: string;
}) {
  const Icon = documentGlyph(mime, name);
  return <Icon className={className} aria-hidden />;
}