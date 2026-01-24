import Image from "next/image";
import { cn } from "@/lib/cn";
import {
  Search,
  User,
  ChevronRight,
  MapPin,
  Home as HomeIcon,
  Wallet,
  ShieldCheck,
  ClipboardList,
  Headphones,
  Star,
} from "lucide-react";
import { Plus_Jakarta_Sans } from "next/font/google";

const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const BRAND = {
  bg: "#A88C74",
  paper: "#FBF6EF",
  paper2: "#F3E7DB",
  ink: "#1D1A17",
  choco: "#2A1F1A",
  line: "rgba(26, 18, 14, 0.10)",
};

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/60 px-2.5 py-1 text-xs font-semibold text-black/70 backdrop-blur">
      {children}
    </span>
  );
}

function MiniStat({ big, label }: { big: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-lg font-extrabold tracking-tight">{big}</div>
      <div className="text-[11px] font-semibold text-black/55">{label}</div>
    </div>
  );
}

function IconCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.08)] backdrop-blur">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white">
        {icon}
      </div>
      <div className="text-sm font-extrabold">{title}</div>
      <div className="mt-1 text-xs leading-relaxed text-black/60">{desc}</div>
    </div>
  );
}

function PropertyCard({
  title,
  location,
  beds,
  sqft,
  price,
}: {
  title: string;
  location: string;
  beds: string;
  sqft: string;
  price: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white/70 shadow-[0_18px_50px_rgba(0,0,0,0.10)] backdrop-blur">
      <div className="relative h-36 w-full">
        <Image
          src="/images/house1.png"
          alt="House"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
      </div>

      <div className="p-3">
        <div className="text-sm font-extrabold">{title}</div>

        <div className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-black/55">
          <MapPin className="h-3.5 w-3.5" />
          <span>{location}</span>
        </div>

        <div className="mt-2 flex items-center justify-between rounded-xl border border-black/10 bg-white/70 px-2.5 py-2 text-[11px] font-semibold text-black/60">
          <span>{beds}</span>
          <span className="h-3 w-px bg-black/10" />
          <span>{sqft}</span>
          <span className="h-3 w-px bg-black/10" />
          <span className="rounded-lg bg-black/5 px-2 py-1 text-black/70">
            Buy Now
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <Chip>$</Chip>
          <div className="text-sm font-extrabold">{price}</div>
        </div>
      </div>
    </div>
  );
}

function TestimonialCard({
  name,
  role,
  rating,
}: {
  name: string;
  role: string;
  rating: number;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-3 shadow-[0_14px_40px_rgba(0,0,0,0.08)] backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[12px] font-extrabold">{name}</div>
          <div className="text-[11px] font-semibold text-black/55">{role}</div>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/70 px-2 py-1 text-[11px] font-extrabold">
          <Star className="h-3.5 w-3.5" />
          {rating.toFixed(1)}
        </div>
      </div>
      <div className="mt-2 text-[11px] leading-relaxed text-black/60">
        I had a fantastic experience working with Dwello. Everything felt smooth,
        guided, and professional.
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <main className={cn(font.className, "min-h-screen")}>
      {/* Outer background */}
      <div className="relative min-h-screen">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.28]"
          style={{
            backgroundImage: "url('/images/background.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        {/* subtle left strip like your mock */}
        <div className="pointer-events-none absolute left-0 top-0 h-full w-[96px] bg-[#f1e5d8]/70" />
        {/* top band */}
        <div className="pointer-events-none absolute left-0 right-0 top-0 h-[132px] bg-black/0" />

        <div className="relative mx-auto max-w-[1200px] px-6 pb-14 pt-10">
          {/* Main layout */}
          <div className="grid gap-7 lg:grid-cols-[1fr_360px]">
            {/* BIG CARD */}
            <section
              className="relative overflow-hidden rounded-[28px] border"
              style={{ borderColor: BRAND.line, background: BRAND.paper }}
            >
              {/* NAV */}
              <div className="flex items-center justify-between px-8 pt-7">
                <div className="flex items-center gap-3">
                  <div className="relative h-9 w-9 overflow-hidden rounded-xl border border-black/10 bg-white">
                    <div className="absolute inset-0 grid place-items-center text-[13px] font-black">
                      D
                    </div>
                  </div>
                  <div className="text-sm font-extrabold tracking-tight">
                    Dwello
                  </div>
                </div>

                <nav className="hidden items-center gap-10 text-sm font-semibold text-black/70 md:flex">
                  <a className="hover:text-black" href="#">
                    Home
                  </a>
                  <a className="hover:text-black" href="#">
                    Service
                  </a>
                  <a className="hover:text-black" href="#">
                    Agents
                  </a>
                  <a className="hover:text-black" href="#">
                    Contact
                  </a>
                </nav>

                <div className="flex items-center gap-4">
                  <button className="grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-white/70 hover:bg-white">
                    <Search className="h-4.5 w-4.5" />
                  </button>
                  <button className="grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-white/70 hover:bg-white">
                    <User className="h-4.5 w-4.5" />
                  </button>
                  <button
                    className="hidden rounded-xl px-5 py-2.5 text-sm font-extrabold text-white shadow-[0_18px_40px_rgba(0,0,0,0.18)] md:inline-flex"
                    style={{ background: BRAND.choco }}
                  >
                    Sign up
                  </button>
                </div>
              </div>

              {/* HERO */}
              <div className="grid gap-10 px-8 pb-8 pt-8 md:grid-cols-[1.05fr_1.2fr] md:items-center">
                <div>
                  <h1 className="text-[44px] font-extrabold leading-[1.02] tracking-tight text-black md:text-[52px]">
                    Find Your
                    <br />
                    Dream Home
                  </h1>
                  <p className="mt-4 max-w-[360px] text-sm font-semibold leading-relaxed text-black/60">
                    Explore our curated selection of exquisite properties
                    meticulously tailored to your unique dream home vision
                  </p>

                  <button
                    className="mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-extrabold text-white shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
                    style={{ background: BRAND.choco }}
                  >
                    Buy Home <ChevronRight className="h-4.5 w-4.5" />
                  </button>
                </div>

                <div className="relative">
                  {/* big house image */}
                  <div className="relative mx-auto h-[320px] w-full max-w-[560px]">
                    <Image
                      src="/images/house1.png"
                      alt="Hero house"
                      fill
                      className="object-contain drop-shadow-[0_34px_60px_rgba(0,0,0,0.18)]"
                      priority
                    />
                    {/* soft glow */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#fbf6ef]" />
                  </div>
                </div>
              </div>

              {/* FILTER BAR */}
              <div className="px-8 pb-10">
                <div
                  className="grid gap-3 rounded-2xl p-4 shadow-[0_20px_60px_rgba(0,0,0,0.12)] md:grid-cols-[1fr_1fr_1fr_180px]"
                  style={{ background: "#D7C4B4" }}
                >
                  <Field label="Location" icon={<MapPin className="h-4 w-4" />} />
                  <Field label="Type" icon={<HomeIcon className="h-4 w-4" />} />
                  <Field label="Price Range" icon={<Wallet className="h-4 w-4" />} />

                  <button
                    className="rounded-xl px-5 py-3 text-sm font-extrabold text-white shadow-[0_16px_40px_rgba(0,0,0,0.20)]"
                    style={{ background: BRAND.choco }}
                  >
                    Search
                  </button>
                </div>
              </div>
            </section>

            {/* RIGHT PREVIEW PANEL */}
            <aside className="hidden lg:block">
              <div className="rounded-[24px] border border-black/10 bg-white/70 p-5 shadow-[0_30px_70px_rgba(0,0,0,0.12)] backdrop-blur">
                {/* TOP */}
                <div className="flex gap-4">
                  <div className="relative h-[86px] w-[110px] overflow-hidden rounded-2xl border border-black/10 bg-white">
                    <Image
                      src="/images/house1.png"
                      alt="Mini hero"
                      fill
                      className="object-cover"
                    />
                  </div>

                  <div className="flex-1">
                    <div className="text-base font-extrabold leading-tight">
                      We Help You To Find
                      <br />
                      Your Dream Home
                    </div>
                    <div className="mt-2 text-[11px] font-semibold leading-relaxed text-black/55">
                      From cozy cottages to luxury estates, our dedicated team
                      guides you through every step  ensuring your dream home
                      becomes a reality.
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-black/10 bg-white/60 p-3 text-black/75">
                  <MiniStat big="8K+" label="Houses Available" />
                  <MiniStat big="6K+" label="Houses Sold" />
                  <MiniStat big="2K+" label="Trusted Agents" />
                </div>

                {/* WHY */}
                <div className="mt-5">
                  <div className="text-sm font-extrabold">Why Choose Us</div>
                  <div className="mt-1 text-[11px] font-semibold text-black/55">
                    Home buying experience with expertise, integrity, and
                    personalized service.
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <IconCard
                      icon={<ShieldCheck className="h-5 w-5" />}
                      title="Trusted Service"
                      desc="Reliable support with verified listings."
                    />
                    <IconCard
                      icon={<ClipboardList className="h-5 w-5" />}
                      title="Transparent Process"
                      desc="Clear steps and honest guidance."
                    />
                    <IconCard
                      icon={<Headphones className="h-5 w-5" />}
                      title="Exceptional Support"
                      desc="Fast responses when you need help."
                    />
                  </div>
                </div>

                {/* POPULAR */}
                <div className="mt-6">
                  <div className="text-sm font-extrabold">Popular Residences</div>
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    <PropertyCard
                      title="Modern Villa"
                      location="Beverly Hills, California"
                      beds="3 Rooms"
                      sqft="1,500 sq ft"
                      price="$850,000"
                    />
                    <PropertyCard
                      title="Skyline Estate"
                      location="Palo Alto, California"
                      beds="6 Rooms"
                      sqft="4,000 sq ft"
                      price="$3,700,000"
                    />
                  </div>
                </div>

                {/* TESTIMONIALS */}
                <div className="mt-6">
                  <div className="text-sm font-extrabold">
                    What People Say
                    <br />
                    About Dwello
                  </div>

                  <div className="mt-3 grid gap-3">
                    <TestimonialCard
                      name="Michael Rodriguez"
                      role="San Diego"
                      rating={4.5}
                    />
                    <TestimonialCard
                      name="Emily Johnson"
                      role="Los Angeles"
                      rating={5.0}
                    />
                  </div>
                </div>
              </div>
            </aside>
          </div>

          {/* Mobile: show the right panel content under hero */}
          <section className="mt-7 lg:hidden">
            <div className="rounded-[24px] border border-black/10 bg-white/70 p-5 shadow-[0_30px_70px_rgba(0,0,0,0.12)] backdrop-blur">
              <div className="text-base font-extrabold leading-tight">
                We Help You To Find Your Dream Home
              </div>
              <div className="mt-2 text-[12px] font-semibold leading-relaxed text-black/55">
                From cozy cottages to luxury estates, we guide you through every
                step  ensuring your dream home becomes a reality.
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-black/10 bg-white/60 p-3">
                <MiniStat big="8K+" label="Houses Available" />
                <MiniStat big="6K+" label="Houses Sold" />
                <MiniStat big="2K+" label="Trusted Agents" />
              </div>

              <div className="mt-5 text-sm font-extrabold">Why Choose Us</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <IconCard
                  icon={<ShieldCheck className="h-5 w-5" />}
                  title="Trusted Service"
                  desc="Reliable support with verified listings."
                />
                <IconCard
                  icon={<ClipboardList className="h-5 w-5" />}
                  title="Transparent Process"
                  desc="Clear steps and honest guidance."
                />
                <IconCard
                  icon={<Headphones className="h-5 w-5" />}
                  title="Exceptional Support"
                  desc="Fast responses when you need help."
                />
              </div>

              <div className="mt-6 text-sm font-extrabold">Popular Residences</div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <PropertyCard
                  title="Modern Villa"
                  location="Beverly Hills, California"
                  beds="3 Rooms"
                  sqft="1,500 sq ft"
                  price="$850,000"
                />
                <PropertyCard
                  title="Skyline Estate"
                  location="Palo Alto, California"
                  beds="6 Rooms"
                  sqft="4,000 sq ft"
                  price="$3,700,000"
                />
              </div>

              <div className="mt-6 text-sm font-extrabold">
                What People Say About Dwello
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <TestimonialCard name="Michael Rodriguez" role="San Diego" rating={4.5} />
                <TestimonialCard name="Emily Johnson" role="Los Angeles" rating={5.0} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/70 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
      <div className="grid h-9 w-9 place-items-center rounded-xl border border-black/10 bg-white">
        <span className="text-black/70">{icon}</span>
      </div>
      <div className="flex-1">
        <div className="text-[12px] font-extrabold text-black/70">{label}</div>
        <div className="text-[11px] font-semibold text-black/45">Select</div>
      </div>
    </div>
  );
}
