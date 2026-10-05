# ExamFlow Foundation

Build the first production-quality frontend foundation for the College of Health CBT portal redesign. This is a PURE CBT/examination application — do NOT include Study Centre, study lessons, lecture notes, revision/study resources, or any study-app functionality. The existing uploaded single-file GAS frontend is the functional reference, but do not copy its old visual design. Create a modern, beautiful, professional examination platform UI with genuinely adaptive UX across phone, tablet/iPad, and desktop. The interface must adapt composition, navigation, density, touch targets, panels/sheets, and interaction patterns to the device rather than merely shrinking a desktop layout. Establish the design system and student-facing shell first: authentication/login, student dashboard/exam availability, and especially a polished responsive exam workspace with authoritative timer/progress, question area, answer options, question navigator, navigation controls, submit flow states, loading/error/empty states. Preserve the product's three exam contexts where relevant: Regular, Pharmacy PreNational, and Continuous. Do not implement fake backend behavior or invent data; create clean service interfaces/placeholders for the existing Supabase backend architecture. The exam UI must be designed so timer, progress and Submit remain accessible on mobile as well as desktop. Use React + TypeScript + Tailwind/shadcn-style architecture, reusable components, accessibility, keyboard support on desktop, touch-first controls on mobile, tablet/iPad-specific layouts, orientation-aware composition, and restrained professional motion. Start with the frontend foundation and student experience; admin/SuperAdmin can follow after the student experience is solid. The old GAS frontend should be treated only as a behavioral reference, not a design reference.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/07832222-96e1-408d-9e38-04f6193dde8b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```


## Frontend role preview

Until real Supabase authentication and role enforcement are connected, open `/auth` and use the **Frontend preview** controls to inspect the Student, Admin, and SuperAdmin interfaces. These controls are temporary development/testing access and should be removed when real role-based authentication is implemented.

Question numbering is user-facing **1 through N**. Internal arrays may remain zero-based.
