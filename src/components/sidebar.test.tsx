import { render, screen } from "@testing-library/react"
import { Sidebar } from "./sidebar"

// Mock Next.js navigation
jest.mock("next/navigation", () => ({
  usePathname: () => "/",
}))

// Mock Next.js Image component
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: { alt: string; [key: string]: unknown }) => <img alt={props.alt} />,
}))

// Mock custom hooks
jest.mock("@/hooks/useStarredProjects", () => ({
  useStarredProjects: () => ({ starredProjects: [] }),
}))

jest.mock("@/hooks/useApprovals", () => ({
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
