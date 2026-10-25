export type Role = "guest" | "customer" | "hotel_management";
export type NavItem = { href: string; label: string };

export const siteConfig = {
  name: "HotelReserve",
  adminSuffix: "Admin",
  description: "Find a room, book it and pay online.",
  // The Profile link for customers is added in step D, when that page exists
  nav: {
    guest: [
      { href: "/rooms", label: "Rooms" },
      { href: "/login", label: "Login" },
      { href: "/register", label: "Register" },
    ],
    customer: [
      { href: "/rooms", label: "Rooms" },
      { href: "/dashboard", label: "My bookings" },
    ],
    hotel_management: [
      { href: "/manage", label: "Dashboard" },
      { href: "/manage/bookings", label: "Bookings" },
      { href: "/manage/rooms", label: "Rooms" },
      { href: "/manage/reports", label: "Reports" },
    ],
  } satisfies Record<Role, NavItem[]>,
};