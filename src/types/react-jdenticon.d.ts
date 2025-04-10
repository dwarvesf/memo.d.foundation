declare module 'react-jdenticon' {
  import React from 'react';

  export interface JdenticonProps {
    /**
     * The string value to generate the icon from
     * @default 'test'
     */
    value: string;

    /**
     * The size of the icon (can be number for pixels or string with units)
     * @default '100%'
     */
    size?: number | string;
  }

  /**
   * A React component that generates deterministic icons based on input values
   * @param props JdenticonProps
   * @returns JSX.Element
   */
  const Jdenticon: React.FC<JdenticonProps>;

  export default Jdenticon;
}
