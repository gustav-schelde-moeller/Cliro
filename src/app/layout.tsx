import type { Metadata } from "next";
import localFont from "next/font/local";
import { IBM_Plex_Mono } from "next/font/google";
import { UpdateChecker } from "@/components/shared/UpdateChecker";
import "./globals.css";

// DAVAI's real brand fonts (handed off alongside cvr-tool and
// financial-dashboard, which already used them under these same names) —
// replaces the Google Fonts placeholders the app launched with.
const davaiExtended = localFont({
  src: "../../public/fonts/HelveticaNeueLTStd_Medium_Extended.otf",
  variable: "--font-davai-extended",
  display: "swap",
});

const davaiMedium = localFont({
  src: "../../public/fonts/HelveticaNeueLTStd_Medium.otf",
  variable: "--font-davai-medium",
  display: "swap",
});

const davaiRoman = localFont({
  src: "../../public/fonts/HelveticaNeueLT_Roman.ttf",
  variable: "--font-davai-roman",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cliro",
  description: "Lead-research og outreach for jeres team.",
};

const THEME_INIT_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem("cliro_theme_v1");
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="da"
      className={`${davaiExtended.variable} ${davaiMedium.variable} ${davaiRoman.variable} ${ibmPlexMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {children}
        <UpdateChecker currentCommit={process.env.VERCEL_GIT_COMMIT_SHA ?? null} />
      </body>
    </html>
  );
}
