'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function ExampleProfile({ name, avatarUrl }: { name: string; avatarUrl: string }) {
  const router = useRouter();

  return (
    <div className="p-4 border rounded-lg shadow-sm w-64 bg-white flex flex-col items-center gap-4">
      <Image 
        src={avatarUrl} 
        alt={`${name}'s avatar`} 
        width={80} 
        height={80} 
        className="rounded-full" 
      />
      <h2 className="text-lg font-bold">{name}</h2>
      
      <button 
        onClick={() => router.push('/settings')}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-full"
      >
        Account Settings
      </button>
      
      <Link href={"/logout" as any} className="text-sm text-gray-500 hover:underline">
        Sign out
      </Link>
    </div>
  );
}