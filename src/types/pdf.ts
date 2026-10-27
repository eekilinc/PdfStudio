export type ToolType =
  | 'select'
  | 'pan'
  | 'edit-text'
  | 'pen'
  | 'highlighter'
  | 'text'
  | 'rect'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'stamp'
  | 'signature'
  | 'image'
  | 'measure'
  | 'checkbox'
  | 'redact'
  | 'eraser'
  | 'comment'
  | 'link';

export type AnnotationType = 
  | 'pen'
  | 'highlighter'
  | 'text'
  | 'rect'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'stamp'
  | 'signature'
  | 'image'
  | 'measure'
  | 'checkbox'
  | 'redact';

export interface Point {
  x: number;
  y: number;
}

export interface BaseAnnotation {
  id: string;
  pageIndex: number;
  type: AnnotationType;
  x: number; // PDF points coordinate (0 to page width)
  y: number; // PDF points coordinate (0 to page height)
  width: number;
  height: number;
  color: string;
  fillColor?: string;
  strokeWidth?: number;
  opacity?: number;
  rotation?: number; // in degrees
  zIndex?: number;
}

export interface DrawingAnnotation extends BaseAnnotation {
  type: 'pen' | 'highlighter';
  points: Point[];
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  backgroundColor?: string;
}

export interface ShapeAnnotation extends BaseAnnotation {
  type: 'rect' | 'circle' | 'line' | 'arrow';
  endX?: number;
  endY?: number;
}

export interface SignatureAnnotation extends BaseAnnotation {
  type: 'signature';
  imageData: string; // Base64 data URL
}

export interface ImageAnnotation extends BaseAnnotation {
  type: 'image';
  imageData: string; // Base64 data URL
}

export interface MeasurementAnnotation extends BaseAnnotation {
  type: 'measure';
  endX: number;
  endY: number;
  distancePt: number;
  distanceFormatted: string;
  unit: 'cm' | 'mm' | 'in' | 'pt';
  scaleRatio?: number; // e.g. 1 pt = 1 unit
}

export interface CheckboxAnnotation extends BaseAnnotation {
  type: 'checkbox';
  checked: boolean;
  label?: string;
}

export interface StampAnnotation extends BaseAnnotation {
  type: 'stamp';
  stampType: 'APPROVED' | 'CONFIDENTIAL' | 'REJECTED' | 'DRAFT' | 'FINAL' | 'COMPLETED' | 'CUSTOM';
  customText?: string;
  subtitle?: string;
  date?: string;
}

export interface RedactionAnnotation extends BaseAnnotation {
  type: 'redact';
  isApplied?: boolean;
}

export type Annotation = 
  | DrawingAnnotation
  | TextAnnotation
  | ShapeAnnotation
  | SignatureAnnotation
  | ImageAnnotation
  | MeasurementAnnotation
  | CheckboxAnnotation
  | StampAnnotation
  | RedactionAnnotation;

export interface PageState {
  pageIndex: number; // 0-based original index
  originalPageNumber: number; // 1-based (0 if blank page)
  displayPageNumber: number; // 1-based current sequence
  rotation: number; // 0, 90, 180, 270
  width: number; // PDF points
  height: number; // PDF points
  aspectRatio: number;
  isDeleted?: boolean;
  isBlank?: boolean;
}

export interface PDFDocumentState {
  filename: string;
  fileSize: number;
  data: ArrayBuffer | null;
  numPages: number;
  pages: PageState[];
  pageOrder: number[]; // Array of page indices
  annotations: Record<number, Annotation[]>; // key is pageIndex
  /**
   * Review comments, read from the file when it was opened and added to
   * while it is open. They are written back as real PDF annotations, so
   * the file keeps them across saves and other readers can answer them.
   */
  comments?: PdfComment[];
  /** Values filled into the interactive form, keyed by field name. */
  formValues?: Record<string, FormFieldValue>;
  /** The fields of the interactive form, as the file holds them. */
  formFields?: FormFieldInfo[];
  /** The hyperlinks of the document, read from the file and edited here. */
  links?: PdfLink[];
  /** The bookmarks of the document, read from the file and edited here. */
  bookmarks?: PdfBookmark[];
  /** The page labels of the document. */
  pageLabels?: PageLabelRange[];
  /** The page transitions of the document. */
  pageTransitions?: PageTransition[];
  /** The page boxes of the document. */
  pageBoxes?: PageBoxSettings[];
  /** What the accessibility checker found and what was done about it. */
  accessibility?: AccessibilityState;
  /** Which layers are shown, keyed by the name of the layer. */
  layerVisibility?: Record<string, boolean>;
  /** The layers of the document, as the file holds them. */
  layers?: PdfLayer[];
  /** The files that are attached to the document. */
  attachments?: PdfAttachment[];
  /** The archival standard the document declares itself to be. */
  pdfa?: { part: string; conformance: string };
  /** What the document inspector removes on the next write. */
  sanitize?: SanitizeOptions;
}

export interface ActiveToolConfig {
  tool: ToolType;
  color: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
  stampType: 'APPROVED' | 'CONFIDENTIAL' | 'REJECTED' | 'DRAFT' | 'FINAL' | 'COMPLETED' | 'CUSTOM';
  customStampText: string;
  measureUnit?: 'cm' | 'mm' | 'in' | 'pt';
}

export interface ExtractedPdfTextItem {
  id: string;
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
}

export interface SearchMatch {
  matchIndex: number;
  pageIndex: number;
  pageNumber: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WatermarkConfig {
  text: string;
  color: string;
  opacity: number;
  fontSize: number;
  rotation: number;
  allPages: boolean;
}

export interface PageNumberingConfig {
  format: 'page_total' | 'simple' | 'dash' | 'page_only' | 'page_of_total';
  position: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left';
  startPage: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  prefix?: string;
  suffix?: string;
}

export interface PdfOutlineItem {
  title: string;
  pageNumber: number;
  pageIndex: number;
  children?: PdfOutlineItem[];
}

/* ------------------------------------------------------------------ *
 * Review comments
 *
 * A comment is a real PDF annotation, not an overlay drawn on the page.
 * The distinction matters: a comment written here is written into the
 * file, so Acrobat, Preview and every other reader sees it as a note,
 * a highlighted phrase or a reply thread.
 * ------------------------------------------------------------------ */

/** The comment flavours the app writes and recognises. */
export type PdfCommentKind = 'note' | 'highlight' | 'underline' | 'strikeout' | 'freetext';

/** Review status of a comment, stored as the PDF /State entry. */
export type PdfCommentStatus = 'Accepted' | 'Rejected' | 'Cancelled' | 'Completed';

/** A rectangle in PDF user space, with the origin at the page's bottom left. */
export interface PdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfComment {
  /** Stable identifier, also written to the annotation's /NM entry. */
  id: string;
  /** Page the comment is anchored to, 0-based. */
  pageIndex: number;
  kind: PdfCommentKind;
  /** Anchor rectangle in PDF points. */
  rect: PdfRect;
  /**
   * Quad points of a text markup, eight numbers per quad in the order
   * Acrobat expects: top left, top right, bottom left, bottom right.
   */
  quads?: number[];
  /** The comment body. */
  contents: string;
  /** Author of the comment. */
  author: string;
  /** Creation date as a PDF date string, for example `D:20260101120000+01'00'`. */
  modified?: string;
  /** Identifier of the comment this one replies to. */
  parentId?: string;
  /** Review status, when the comment has been resolved. */
  status?: PdfCommentStatus;
  /** Icon and markup colour, as `#RRGGBB`. */
  color?: string;
}

/* ------------------------------------------------------------------ *
 * Interactive forms
 * ------------------------------------------------------------------ */

/** The field types of an AcroForm, mapped to what the panel can edit. */
export type FormFieldKind =
  | 'text'
  | 'checkbox'
  | 'radio'
  | 'dropdown'
  | 'listbox'
  | 'button'
  | 'signature';

/** A field value: text, a flag, or the selected options of a list. */
export type FormFieldValue = string | boolean | string[];

export interface FormFieldInfo {
  /** Fully qualified field name, unique inside one form. */
  name: string;
  kind: FormFieldKind;
  /** Value the field carries in the file. */
  value: FormFieldValue;
  /** Choices of a combo box or a list box. */
  options: string[];
  readOnly: boolean;
  required: boolean;
  multiline: boolean;
  /** Page the field's widget sits on, 0-based, or -1 when it cannot be found. */
  pageIndex: number;
}

/* ------------------------------------------------------------------ *
 * Hyperlinks
 * ------------------------------------------------------------------ */

/** Whether a link leaves the document or jumps inside it. */
export type PdfLinkKind = 'external' | 'internal';

export interface PdfLink {
  /** Stable identifier, also written to the annotation's /NM entry. */
  id: string;
  /** Page the link sits on, 0-based. */
  pageIndex: number;
  kind: PdfLinkKind;
  /** The clickable rectangle, in the app's top-left page space. */
  rect: PdfRect;
  /** The address of an external link. */
  url?: string;
  /** The page an internal link points at, 0-based. */
  targetPageIndex?: number;
  /** How far down the target page the link lands, in PDF points. */
  targetY?: number;
}

/* ------------------------------------------------------------------ *
 * Bookmarks (the document outline)
 * ------------------------------------------------------------------ */

export interface PdfBookmark {
  /** Stable identifier. */
  id: string;
  /** The text shown in the outline. */
  title: string;
  /** The page the bookmark points at, 0-based. */
  pageIndex: number;
  /** How far down the page the bookmark lands, in PDF points. */
  top?: number;
  /** The bookmarks nested under this one. */
  children?: PdfBookmark[];
}

/* ------------------------------------------------------------------ *
 * Page setup: labels, boxes and transitions
 * ------------------------------------------------------------------ */

/** The numbering style of a range of page labels. */
export type PageLabelStyle = 'D' | 'R' | 'r' | 'A' | 'a';

export interface PageLabelRange {
  /** The first page of the range, 0-based. */
  startPage: number;
  /** The style the numbers are written in. */
  style: PageLabelStyle;
  /** The number the first page of the range carries. */
  first: number;
  /** A prefix written before the number, such as `A-`. */
  prefix?: string;
}

/** The page transition effects a document can carry. */
export type PageTransitionStyle =
  | 'Split'
  | 'Blinds'
  | 'Box'
  | 'Wipe'
  | 'Dissolve'
  | 'Glitter'
  | 'Fly'
  | 'Push'
  | 'Cover'
  | 'Uncover'
  | 'Fade';

export interface PageTransition {
  /** The page the transition belongs to, 0-based. */
  pageIndex: number;
  style: PageTransitionStyle;
  /** How long the transition lasts, in seconds. */
  duration: number;
}

/** The boxes a page can carry besides its media box. */
export type PageBoxKind = 'CropBox' | 'TrimBox' | 'BleedBox' | 'ArtBox';

export interface PageBoxSettings {
  /** The page the box belongs to, 0-based. */
  pageIndex: number;
  box: PageBoxKind;
  /** The margins measured inward from the media box, in PDF points. */
  left: number;
  bottom: number;
  right: number;
  top: number;
}

/* ------------------------------------------------------------------ *
 * Layers and embedded files
 * ------------------------------------------------------------------ */

/** An optional content group, the layer a reader can turn on and off. */
export interface PdfLayer {
  /** The identity of the group inside the file. */
  id: string;
  /** The name the group carries. */
  name: string;
  /** Whether the layer is shown. */
  visible: boolean;
  /** Whether the layer cannot be turned off. */
  locked: boolean;
  /** The pages the layer appears on, 0-based. */
  pageIndexes: number[];
}

/** A file that is attached to the document. */
export interface PdfAttachment {
  /** The name of the attachment. */
  id: string;
  name: string;
  /** The description of the attachment, when it has one. */
  description?: string;
  /** The size of the file in bytes. */
  size: number;
  /** The kind of the file, as the file says. */
  mimeType: string;
}

/* ------------------------------------------------------------------ *
 * Accessibility
 * ------------------------------------------------------------------ */

/**
 * What the accessibility checker found and what was done about it.
 *
 * The settings are written into the file when the document is saved, so
 * the fixes survive and the document stays accessible afterwards.
 */
export interface AccessibilityState {
  /** Whether the document is tagged by the application. */
  tagged: boolean;
  /** The descriptions of the figures, keyed by `page:name`. */
  altTexts: Record<string, string>;
  /** The language of the document, written as a language tag. */
  language?: string;
  /** The title of the document; an empty title removes it. */
  title?: string;
  /** Whether the window title of a reader shows the title of the document. */
  displayDocTitle?: boolean;
  /** Whether the form fields carry a description. */
  fieldDescriptions?: boolean;
}

/* ------------------------------------------------------------------ *
 * Document inspector
 * ------------------------------------------------------------------ */

/**
 * What the document inspector removes when the file is written.
 *
 * Every category maps to a concrete object in the file, so the options
 * are also what the scanner reports as "found in this document".
 */
export interface SanitizeOptions {
  /** Document information: title, author, subject, keywords, producer. */
  metadata?: boolean;
  /** The XMP metadata stream of the catalog. */
  xmp?: boolean;
  /** Embedded files attached to the document. */
  attachments?: boolean;
  /** Document level JavaScript and automatic actions. */
  javascript?: boolean;
  /** Hyperlinks in the document. */
  links?: boolean;
  /** Interactive form fields and their widgets. */
  formFields?: boolean;
  /** Review comments and their pop-ups. */
  comments?: boolean;
}

/** One finding of the document scanner. */
export interface SanitizeFinding {
  /** Machine readable category, matching the option names above. */
  category: keyof SanitizeOptions;
  /** Human readable description of what was found. */
  detail: string;
  /** How many objects of this kind the document holds. */
  count: number;
}

export type ReaderFilter = 'normal' | 'sepia' | 'dark' | 'contrast';
