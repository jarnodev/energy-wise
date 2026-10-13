"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// Applies the theme class before the page paints, so there is no flash of the wrong theme
export function ThemeProvider({ children }: { children: React.ReactNode })
{
    return (
        <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {children}
        </NextThemesProvider>
    );
}
