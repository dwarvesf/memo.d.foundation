// styled-jsx attribute support for <style jsx global> in the Pages Router.
// Next ships this augmentation in next/dist/styled-jsx/types/global.d.ts but
// does not auto-include it in next-env.d.ts, so we declare it here.
import 'react';

declare module 'react' {
  interface StyleHTMLAttributes<T> extends HTMLAttributes<T> {
    jsx?: boolean;
    global?: boolean;
  }
}
