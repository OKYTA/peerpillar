import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'PeerPillar — Your next chapter, together',description:'A personal roadmap. A peer who understands. IELTS, SAT and admissions mentoring in one thoughtful workspace.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>}
