import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAuth } from "@/hooks/use-auth";

// Mocks
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockSignInAction = vi.mocked(signInAction);
const mockSignUpAction = vi.mocked(signUpAction);
const mockGetAnonWorkData = vi.mocked(getAnonWorkData);
const mockClearAnonWork = vi.mocked(clearAnonWork);
const mockGetProjects = vi.mocked(getProjects);
const mockCreateProject = vi.mocked(createProject);

const ANON_WORK = {
  messages: [{ role: "user", content: "make a button" }],
  fileSystemData: { "/App.jsx": { content: "<button />" } },
};

const PROJECTS = [
  { id: "proj-1", name: "Project 1" },
  { id: "proj-2", name: "Project 2" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([] as any);
  mockCreateProject.mockResolvedValue({ id: "new-proj" } as any);
});

describe("useAuth", () => {
  describe("initial state", () => {
    it("exposes signIn, signUp, and isLoading=false", () => {
      const { result } = renderHook(() => useAuth());

      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
      expect(result.current.isLoading).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // signIn
  // ---------------------------------------------------------------------------
  describe("signIn", () => {
    it("returns the result from the sign-in action", async () => {
      mockSignInAction.mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());
      let returned: any;

      await act(async () => {
        returned = await result.current.signIn("a@b.com", "wrong");
      });

      expect(returned).toEqual({ success: false, error: "Invalid credentials" });
    });

    it("sets isLoading to true while in-flight and false when done", async () => {
      let resolveSignIn!: (v: any) => void;
      mockSignInAction.mockReturnValue(new Promise((r) => (resolveSignIn = r)));

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.signIn("a@b.com", "pass");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignIn({ success: false });
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("resets isLoading to false even when the action throws", async () => {
      mockSignInAction.mockRejectedValue(new Error("network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "pass").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("does NOT navigate when sign-in fails", async () => {
      mockSignInAction.mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "bad-pass");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    describe("post sign-in: anonymous work exists", () => {
      beforeEach(() => {
        mockSignInAction.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue(ANON_WORK);
        mockCreateProject.mockResolvedValue({ id: "anon-proj" } as any);
      });

      it("creates a project with the anon work and navigates to it", async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("a@b.com", "pass123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: ANON_WORK.messages,
            data: ANON_WORK.fileSystemData,
          })
        );
        expect(mockPush).toHaveBeenCalledWith("/anon-proj");
      });

      it("clears the anon work after saving", async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("a@b.com", "pass123");
        });

        expect(mockClearAnonWork).toHaveBeenCalled();
      });

      it("does NOT call getProjects when anon work is present", async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("a@b.com", "pass123");
        });

        expect(mockGetProjects).not.toHaveBeenCalled();
      });
    });

    describe("post sign-in: anon work has no messages (empty)", () => {
      beforeEach(() => {
        mockSignInAction.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
        mockGetProjects.mockResolvedValue(PROJECTS as any);
      });

      it("falls through to project lookup when messages array is empty", async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("a@b.com", "pass123");
        });

        expect(mockGetProjects).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith(`/${PROJECTS[0].id}`);
      });
    });

    describe("post sign-in: no anon work, user has existing projects", () => {
      beforeEach(() => {
        mockSignInAction.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue(PROJECTS as any);
      });

      it("navigates to the most recent project", async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("a@b.com", "pass123");
        });

        expect(mockPush).toHaveBeenCalledWith(`/${PROJECTS[0].id}`);
      });

      it("does NOT create a new project", async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("a@b.com", "pass123");
        });

        expect(mockCreateProject).not.toHaveBeenCalled();
      });
    });

    describe("post sign-in: no anon work, no existing projects", () => {
      beforeEach(() => {
        mockSignInAction.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([]);
        mockCreateProject.mockResolvedValue({ id: "brand-new" } as any);
      });

      it("creates a new empty project and navigates to it", async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("a@b.com", "pass123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith(
          expect.objectContaining({ messages: [], data: {} })
        );
        expect(mockPush).toHaveBeenCalledWith("/brand-new");
      });
    });
  });

  // ---------------------------------------------------------------------------
  // signUp
  // ---------------------------------------------------------------------------
  describe("signUp", () => {
    it("returns the result from the sign-up action", async () => {
      mockSignUpAction.mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());
      let returned: any;

      await act(async () => {
        returned = await result.current.signUp("existing@b.com", "pass123");
      });

      expect(returned).toEqual({ success: false, error: "Email already registered" });
    });

    it("sets isLoading to true while in-flight and false when done", async () => {
      let resolveSignUp!: (v: any) => void;
      mockSignUpAction.mockReturnValue(new Promise((r) => (resolveSignUp = r)));

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.signUp("new@b.com", "pass123");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignUp({ success: false });
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("resets isLoading to false even when the action throws", async () => {
      mockSignUpAction.mockRejectedValue(new Error("network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@b.com", "pass123").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("does NOT navigate when sign-up fails", async () => {
      mockSignUpAction.mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("existing@b.com", "pass123");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    describe("post sign-up: anonymous work exists", () => {
      beforeEach(() => {
        mockSignUpAction.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue(ANON_WORK);
        mockCreateProject.mockResolvedValue({ id: "anon-proj" } as any);
      });

      it("creates a project with the anon work and navigates to it", async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("new@b.com", "pass123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: ANON_WORK.messages,
            data: ANON_WORK.fileSystemData,
          })
        );
        expect(mockPush).toHaveBeenCalledWith("/anon-proj");
      });

      it("clears the anon work after saving", async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("new@b.com", "pass123");
        });

        expect(mockClearAnonWork).toHaveBeenCalled();
      });
    });

    describe("post sign-up: no anon work, no existing projects", () => {
      beforeEach(() => {
        mockSignUpAction.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([]);
        mockCreateProject.mockResolvedValue({ id: "first-proj" } as any);
      });

      it("creates a new empty project and navigates to it", async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("new@b.com", "pass123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith(
          expect.objectContaining({ messages: [], data: {} })
        );
        expect(mockPush).toHaveBeenCalledWith("/first-proj");
      });
    });

    describe("post sign-up: no anon work, user already has projects", () => {
      beforeEach(() => {
        mockSignUpAction.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue(PROJECTS as any);
      });

      it("navigates to the most recent project without creating a new one", async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("new@b.com", "pass123");
        });

        expect(mockPush).toHaveBeenCalledWith(`/${PROJECTS[0].id}`);
        expect(mockCreateProject).not.toHaveBeenCalled();
      });
    });
  });
});
