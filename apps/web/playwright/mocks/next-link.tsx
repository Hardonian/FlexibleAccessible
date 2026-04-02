import React from 'react';

// A simple standard HTML anchor tag to replace Next.js <Link />
export default function MockNextLink({ href, children, ...props }: any) {
  return <a href={href} {...props}>{children}</a>;
}