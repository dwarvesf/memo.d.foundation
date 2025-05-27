declare global {
  interface Window {
    _memo_frontmatter: {
      redirect?: string[];
      title?: string;
      tags?: string[];
      description?: string;
    };
  }
}
export {};
