export function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode })
{
    return (
        <section id={id} aria-labelledby={`${id}-title`} className="space-y-4">
            <div>
                <h2 id={`${id}-title`} className="text-xl font-semibold tracking-tight">{title}</h2>
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            {children}
        </section>
    );
}

// A labelled figure for stat rows: small label above a value
export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode })
{
    return (
        <div className="min-w-0">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="truncate text-lg font-semibold">{value}</div>
            {hint && <div className="truncate text-xs text-muted-foreground">{hint}</div>}
        </div>
    );
}
