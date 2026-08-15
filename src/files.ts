import { getTreasure } from './bridge';

export interface FileReference { id: string; name: string; kind: 'file'; }
export interface DirectoryReference { id: string; name: string; kind: 'directory'; }
export interface OpenDialogOptions {
  kind: 'file' | 'directory';
  multiple?: boolean;
  title?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

/** Options for the native, single-window system "Save As" dialog. */
export interface SaveDialogOptions {
  title?: string;
  /** Suggested filename shown in the system dialog; this is not a path. */
  defaultFileName: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  /** Optional, previously authorized directory used as the initial location. */
  initialDirectory?: DirectoryReference;
}

export type WriteFileInput =
  | { directory: DirectoryReference; fileName: string; data: Uint8Array; file?: never }
  | { file: FileReference; data: Uint8Array; directory?: never; fileName?: never };

/** File primitives only: choose, read the returned file reference, and write under a directory reference. */
export const files = {
  openDialog: (options: OpenDialogOptions) => getTreasure().files.openDialog(options),
  saveDialog: (options: SaveDialogOptions) => getTreasure().files.saveDialog(options),
  readFile: (file: FileReference) => getTreasure().files.readFile(file),
  writeFile: (input: WriteFileInput) => getTreasure().files.writeFile(input),
};
