import React from "react";

export default function Footer()
{
    return (
        <footer className="w-full border-t bg-background py-6 text-center text-muted-foreground text-sm">
            <div>
                © {new Date().getFullYear()} Energy Wise. All rights reserved.
            </div>
            <div className="mt-2">
                Made with <span className="text-red-500">♥</span> by <a href="https://github.com/jarnodev" className="text-blue-500 hover:underline">JarnoDev</a>
            </div>
        </footer>
    );
}
