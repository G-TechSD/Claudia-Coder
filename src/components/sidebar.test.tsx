import React from "react"
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from "@testing-library/react"
import { Sidebar } from "./sidebar"

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}))

// Mock Next.js Link component
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// Mock Next.js Image component
vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, ...props }: { alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}))

// Mock custom hooks
vi.mock("@/hooks/useStarredProjects", () => ({
  useStarredProjects: () => ({ starredProjects: [] }),
}))

vi.mock("@/hooks/useApprovals", () => ({
  useApprovals: () => ({ pendingCount: 0 }),
}))

describe("Sidebar", () => {
  it("renders the sidebar component", () => {
    render(<Sidebar />)

    expect(screen.getByRole("complementary")).toBeInTheDocument()
  })

  it("shows Claudia Coder branding", () => {
    render(<Sidebar />)

    expect(screen.getByText("Claudia Coder")).toBeInTheDocument()
    expect(screen.getByAltText("Claudia Coder")).toBeInTheDocument()
  })
})
