"use client";
import * as React from "react";
import { useTheme } from "./theme-provider";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { Button } from "./ui/button";
import
{
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { cn } from "../lib/utils";

export function ThemeToggler()
{
    const { theme, setTheme } = useTheme();
    const icon =
        theme === "light"
            ? <Sun className="h-10 w-10 text-yellow-500 transition-all" />
            : theme === "dark"
                ? <Moon className="h-10 w-10 text-blue-600 transition-all" />
                : <Monitor className="h-10 w-10 text-gray-500 transition-all" />;

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="secondary"
                        size="icon"
                        aria-label="Toggle theme"
                        className="relative shadow-lg ring-2 ring-primary/30 hover:ring-primary/60 focus-visible:ring-4 focus-visible:ring-primary h-12 w-12"
                    >
                        {icon}
                        <span className="sr-only">Toggle theme</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 text-base">
                    <DropdownMenuLabel className="text-base">Theme</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={() => setTheme("light")}
                        className={cn(
                            "flex items-center gap-2 py-2.5",
                            theme === "light" && "bg-accent/60 font-semibold text-primary"
                        )}
                    >
                        <Sun className="h-7 w-7 text-yellow-500" /> Light
                        {theme === "light" && <Check className="ml-auto h-6 w-6 text-primary" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => setTheme("dark")}
                        className={cn(
                            "flex items-center gap-2 py-2.5",
                            theme === "dark" && "bg-accent/60 font-semibold text-primary"
                        )}
                    >
                        <Moon className="h-7 w-7 text-blue-600" /> Dark
                        {theme === "dark" && <Check className="ml-auto h-6 w-6 text-primary" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => setTheme("system")}
                        className={cn(
                            "flex items-center gap-2 py-2.5",
                            theme === "system" && "bg-accent/60 font-semibold text-primary"
                        )}
                    >
                        <Monitor className="h-7 w-7 text-gray-500" /> System
                        {theme === "system" && <Check className="ml-auto h-6 w-6 text-primary" />}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
