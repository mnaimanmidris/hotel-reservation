import Link from "next/link";
import { connection } from "next/server";
import { InstallAppButton } from "@/components/install-app-button";
import { getSettings } from "@/lib/settings";

export async function SiteFooter() {
  await connection();
  const settings = await getSettings();
  const name = String(settings["brand.name"]);
  const tagline = String(settings["brand.tagline"]);
  const email = String(settings["footer.contact_email"]).trim();
  const phone = String(settings["footer.contact_phone"]).trim();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-card text-card-foreground">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:grid-cols-3 sm:px-8">
        <div className="flex flex-col gap-1">
          <p className="font-semibold">{name}</p>
          {tagline && (
            <p className="text-sm text-muted-foreground">{tagline}</p>
          )}
        </div>

        <nav aria-label="Footer" className="flex flex-col gap-1 text-sm">
          <Link href="/" className="w-fit text-muted-foreground hover:text-foreground">
            Home
          </Link>
          <Link href="/rooms" className="w-fit text-muted-foreground hover:text-foreground">
            Rooms
          </Link>
          <InstallAppButton />
        </nav>

        {(email || phone) && (
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-medium">Contact</p>
            {email && (
              <a
                href={`mailto:${email}`}
                className="w-fit break-all text-muted-foreground hover:text-foreground"
              >
                {email}
              </a>
            )}
            {phone && (
              <a
                href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                className="w-fit text-muted-foreground hover:text-foreground"
              >
                {phone}
              </a>
            )}
          </div>
        )}
      </div>
      <p className="border-t px-4 py-4 text-center text-xs text-muted-foreground">
        © {year} {name}
      </p>
    </footer>
  );
}