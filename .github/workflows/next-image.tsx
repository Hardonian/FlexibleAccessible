import React from 'react';

// A simple standard HTML image tag to replace Next.js <Image />
export default function MockNextImage({ src, alt, width, height, className, ...props }: any) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} width={width} height={height} className={className} {...props} />;
}