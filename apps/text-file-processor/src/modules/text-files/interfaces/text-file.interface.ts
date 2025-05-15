export interface TextFileKey {
  readonly id: string;
}

export interface TextFile extends TextFileKey {
  timestamp: string;
  content: string;
}
