"use client";
import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({
    theme: "system",
    setTheme: (theme: "light" | "dark" | "system") => { },
});

export function ThemeProvider({ children }: { children: React.ReactNode })
{
    const [theme, setThemeState] = useState<"light" | "dark" | "system">("system");

    useEffect(() =>
    {
        // Load theme from localStorage
        const stored = localStorage.getItem("theme");
        if (stored === "light" || stored === "dark" || stored === "system") {
            setThemeState(stored);
        }
    }, []);

    useEffect(() =>
    {
        let appliedTheme = theme;
        if (theme === "system") {
            const mq = window.matchMedia("(prefers-color-scheme: dark)");
            appliedTheme = mq.matches ? "dark" : "light";
        }
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(appliedTheme);
        localStorage.setItem("theme", theme);
    }, [theme]);

    const setTheme = (t: "light" | "dark" | "system") => setThemeState(t);

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme()
{
    return useContext(ThemeContext);
}
