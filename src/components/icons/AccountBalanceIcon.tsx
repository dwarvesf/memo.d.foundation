import React from 'react';

function AccountBalanceIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      {...props}
    >
      <g id="Type=account_balance">
        <mask
          id="mask0_1363_7975"
          style={{ maskType: 'alpha' }}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="24"
          height="24"
        >
          <rect id="Bounding box" width="24" height="24" fill="#D9D9D9" />
        </mask>
        <g mask="url(#mask0_1363_7975)">
          <path
            id="account_balance"
            d="M5.75028 16.9999V9.49987H7.25028V16.9999H5.75028ZM11.2503 16.9999V9.49987H12.7503V16.9999H11.2503ZM2.76953 20.4999V18.9999H21.231V20.4999H2.76953ZM16.7503 16.9999V9.49987H18.2503V16.9999H16.7503ZM2.76953 7.49987V6.07687L12.0003 1.55762L21.231 6.07687V7.49987H2.76953ZM6.31553 5.99987H17.685L12.0003 3.24987L6.31553 5.99987Z"
            fill="currentColor"
          />
        </g>
      </g>
    </svg>
  );
}

export default AccountBalanceIcon;
