import { SVGAttributes } from 'react';

export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg {...props} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
                fill="currentColor"
                d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4v3c0 .6.4 1 1 1 .2 0 .5-.1.7-.3L15.4 18H20c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H15l-4 3v-3H4V4h16v12z"
            />
            <path
                fill="currentColor"
                d="M7 9h2v2H7zm3-1h2v2h-2zm3 1h2v2h-2z"
            />
        </svg>
    );
}
