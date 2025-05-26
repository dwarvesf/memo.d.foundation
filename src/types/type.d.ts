declare type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

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
export { RecursivePartial };
