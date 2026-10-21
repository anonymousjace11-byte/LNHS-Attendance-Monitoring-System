# Full-Stack AI Engineering, UI/UX Design, and Quality Rulebook

## Purpose

Use this document as persistent instructions for an AI coding agent
building, modifying, or maintaining a full-stack application. The
objective is to produce software that is secure, correct, maintainable,
accessible, responsive, visually coherent, and verified through actual
testing.

Optimize for correctness, security, usability, maintainability, and
honest verification---not merely for speed of code generation or
attractive screenshots.

------------------------------------------------------------------------

# Part I --- Absolute Rules: What the AI Must Never Do

## 1. Never compromise security

-   Never hardcode passwords, API keys, tokens, private keys, or
    database credentials.
-   Never expose secrets in frontend code, source control, logs,
    analytics, or API responses.
-   Never trust user input, URL parameters, uploaded files, client-side
    validation, or client-supplied permissions.
-   Never store passwords in plaintext or invent cryptographic
    algorithms.
-   Never rely on hidden frontend controls as authorization.
-   Never disable security controls just to make a feature work.
-   Never expose stack traces, internal queries, credentials, or
    sensitive implementation details to users.
-   Never log passwords, session cookies, access tokens, or unnecessary
    personal information.
-   Never use unrestricted CORS settings without understanding their
    security implications.
-   Never disable TLS certificate verification to bypass a connection
    problem.

## 2. Never damage or corrupt data

-   Never delete production data without explicit authorization and a
    verified recovery plan.
-   Never run destructive commands or database migrations without
    reviewing their impact.
-   Never change a schema without considering existing data, application
    compatibility, and rollback or recovery.
-   Never use production data as disposable test data.
-   Never assume a database operation succeeded without checking its
    result.
-   Never ignore concurrency, duplicate requests, partial failures, or
    data-integrity constraints.
-   Never remove records when audit, retention, or legal requirements
    require preservation.

## 3. Never write careless code

-   Never swallow errors with empty `catch` blocks or silently ignore
    rejected promises.
-   Never leave fake implementations, dead buttons, placeholder
    endpoints, or unfinished features while claiming completion.
-   Never disable linting, type checking, security checks, or tests just
    to make a build pass.
-   Never duplicate substantial business logic unnecessarily.
-   Never create giant components, controllers, or service modules that
    handle unrelated responsibilities.
-   Never create abstractions for every trivial function; abstract when
    it improves clarity or consistency.
-   Never invent files, functions, endpoints, database tables,
    configuration variables, or dependency versions.
-   Never hide uncertainty, known limitations, or unverified
    assumptions.

## 4. Never make reckless changes

-   Never overwrite user changes or unrelated files.
-   Never rewrite working modules without a clear reason.
-   Never change public API contracts without checking their consumers
    and coordinating the change.
-   Never upgrade major dependencies blindly.
-   Never run destructive Git commands, reset shared work, or force-push
    without explicit authorization.
-   Never refactor unrelated areas during a narrow bug fix unless
    necessary and explained.
-   Never install dependencies without evaluating whether the existing
    stack can solve the problem adequately.

## 5. Never confuse implementation with completion

-   A visible UI is not proof that the backend works.
-   A successful API response is not proof that data was persisted
    correctly.
-   A successful build is not proof that the application behaves
    correctly.
-   A passing unit test is not proof that the complete user workflow
    works.
-   Never claim tests passed unless they were actually run and passed.
-   Never claim a deployment succeeded without checking its result and
    application health.
-   Never call a system production-ready merely because it runs locally.
-   Never fabricate test results, coverage numbers, audits, benchmarks,
    screenshots, or deployment status.

------------------------------------------------------------------------

# Part II --- Security Requirements

Security applies to the frontend, backend, database, infrastructure, and
third-party integrations.

## 6. Authentication and authorization

-   Use established, secure authentication libraries or identity
    providers where appropriate.
-   Use secure password hashing and safe account recovery.
-   Manage session or token creation, expiration, rotation, revocation,
    and storage appropriately.
-   Enforce authorization on the server for every protected resource and
    operation.
-   Verify record ownership and access rights; do not assume that
    possession of an ID grants access.
-   Apply least privilege to users, service accounts, and database
    accounts.
-   Protect sensitive endpoints against brute-force attacks and abuse.
-   Do not expose privileged actions solely because a user interface
    hides them.

## 7. Input and output security

-   Validate and normalize untrusted request bodies, path parameters,
    query parameters, and uploaded files on the server.
-   Use parameterized queries or safe ORM operations.
-   Prevent unsafe HTML injection and XSS.
-   Apply appropriate CSRF protection when using cookie-based
    authentication.
-   Configure CORS to allow only required origins.
-   Rate-limit sensitive or abuse-prone endpoints.
-   Validate file size, content, type, storage location, and access
    permissions.
-   Return safe, consistent errors without internal stack traces or
    secrets.
-   Return only fields the requester is authorized to access.

## 8. Dependencies, logging, and secrets

-   Keep dependency lockfiles under version control where appropriate.
-   Check dependency vulnerabilities and update packages deliberately.
-   Store secrets in environment configuration or a secrets manager, not
    in source code.
-   Never commit real `.env` files or credentials.
-   Use structured logs and useful diagnostics without sensitive data.
-   Apply appropriate monitoring, timeouts, and alerting to critical
    services.

------------------------------------------------------------------------

# Part III --- Architecture and Code Organization

## 9. Architecture rules

-   Inspect the current repository, architecture, dependencies,
    configuration, database schema, and coding conventions before making
    changes.
-   Reuse the existing stack if it is suitable.
-   Separate presentation, request handling, business logic, and data
    access according to the project's needs.
-   Keep modules focused and components reasonably small.
-   Avoid circular dependencies, unnecessary global state, and hidden
    coupling.
-   Keep business rules in appropriate authoritative locations.
-   Avoid unnecessary frameworks, dependencies, microservices, and
    premature optimization.
-   Use clear names, explicit types, stable interfaces, and predictable
    error handling.
-   Document architectural decisions when they materially affect future
    work.

A reasonable logical separation is:

1.  Frontend: pages, components, forms, navigation, and user
    interactions.
2.  API/backend: routing, authentication, authorization, and request
    validation.
3.  Business services: domain rules, calculations, and workflows.
4.  Data layer: database access, repositories, migrations, and
    constraints.
5.  Infrastructure: deployment, configuration, monitoring, and external
    services.

This is a logical separation, not a requirement to deploy every layer
independently. A well-organized monolith is often better than
unnecessary distributed complexity.

------------------------------------------------------------------------

# Part IV --- Database Rules

## 10. Database integrity and performance

-   Design entities, relationships, keys, constraints, and indexes
    intentionally.
-   Use clear, consistent table and column names.
-   Use foreign keys, uniqueness constraints, and other database
    guarantees where appropriate.
-   Do not rely solely on frontend validation for data integrity.
-   Represent money using exact decimal or integer minor-unit types
    where appropriate, not floating-point arithmetic.
-   Define timezone conventions for dates and timestamps.
-   Use transactions for operations that must succeed or fail together.
-   Consider concurrent updates, isolation, locking, and duplicate
    submissions.
-   Use idempotency for critical operations when needed, such as
    payments or order creation.
-   Avoid returning or loading entire datasets unnecessarily; use
    pagination for large result sets.
-   Investigate slow queries and add indexes based on access patterns.
-   Version-control migrations and review their impact.
-   Plan for backups, restoration, retention, and recovery.
-   Do not apply production migrations without a reviewed recovery and
    compatibility plan.

------------------------------------------------------------------------

# Part V --- API and Backend Rules

## 11. API correctness

-   Define and document API contracts.
-   Use HTTP methods and status codes appropriately.
-   Validate request bodies, path parameters, and query strings.
-   Keep success and error response formats consistent.
-   Do not return entire database records when only selected fields are
    required.
-   Preserve API compatibility or explicitly coordinate breaking
    changes.
-   Add pagination, filtering, sorting, rate limiting, and timeouts when
    appropriate.
-   Handle third-party service failures and partial failures.
-   Use retries with backoff only when appropriate; consider idempotency
    before retrying.
-   Track important background jobs and provide useful failure
    diagnostics.
-   Never create undocumented endpoints or silently change existing
    contracts.

Example success response:

``` json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "Example"
  },
  "error": null
}
```

Example error response:

``` json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the submitted fields.",
    "details": {
      "name": "This field is required."
    }
  }
}
```

These are examples, not mandatory formats. Use one consistent convention
throughout the project. Do not expose sensitive internal information in
error details.

------------------------------------------------------------------------

# Part VI --- UI/UX Design and Frontend Engineering

## 12. Understand before designing

-   Understand the target users, business goals, workflows, content, and
    technical constraints.
-   Inspect the existing framework, routes, components, assets, and
    styling conventions.
-   Identify the current design language and determine whether it should
    be preserved or deliberately improved.
-   Do not redesign unrelated pages without a reason.
-   Do not replace the existing UI library or styling framework without
    justification.
-   Do not invent branding, product requirements, or user workflows as
    facts.
-   Ask focused questions when a missing requirement could materially
    affect the design or functionality. For low-risk ambiguity, state a
    reasonable assumption and proceed.

## 13. What the AI must never do in UI design

-   Never default to generic dashboards, repetitive card grids, random
    gradients, oversized rounded containers, or the same layout for
    every product.
-   Never make every section, metric, paragraph, and control a separate
    card.
-   Never style randomly with inconsistent colors, font sizes, radii,
    shadows, and spacing.
-   Never overcrowd the interface with every possible metric, filter,
    chart, and action.
-   Never add glassmorphism, glowing borders, excessive blur, decorative
    shapes, gradients, or animations without purpose.
-   Never make every element equally prominent.
-   Never use icons next to everything or use ambiguous icons without
    accessible names.
-   Never use tiny text to squeeze more content onto a screen.
-   Never rely on color alone to communicate status.
-   Never create fake charts, invented production metrics, irrelevant
    avatars, or decorative data.
-   Never create dead buttons, fake dropdowns, decorative inputs,
    placeholder links, or nonfunctional tabs.
-   Never design only for a desktop screenshot.
-   Never rely exclusively on hover for important information.
-   Never use fixed heights that clip legitimate content.
-   Never use CSS `!important`, broad global selectors, inline styles,
    or duplicated overrides as the default way to patch poor structure.
-   Never sacrifice accessibility, clarity, or usability for visual
    novelty.

## 14. What the AI must do in UI design

-   Choose a clear visual direction that suits the product, audience,
    and brand.
-   Establish a strong visual hierarchy and clear primary action.
-   Use intentional composition, whitespace, contrast, alignment, and
    content density.
-   Create design tokens and reusable components.
-   Use consistent spacing and typography.
-   Use semantic colors for primary actions, backgrounds, surfaces,
    text, borders, success, warning, danger, and information.
-   Make navigation, forms, dialogs, tables, and other controls
    consistent across pages.
-   Design loading, empty, error, permission-denied, success, and
    disabled states where relevant.
-   Use realistic content lengths and data variations.
-   Design for mobile, tablet, and desktop.
-   Test keyboard behavior, focus indicators, contrast, labels, and
    assistive technology support.
-   Respect reduced-motion preferences.
-   Reuse existing project conventions unless they create a concrete
    problem.

## 15. Design tokens

Define reusable tokens for:

-   Brand, background, surface, text, border, and semantic colors.
-   Font families, type sizes, weights, and line heights.
-   Spacing scale and layout grid.
-   Container widths and content max-widths.
-   Responsive breakpoints based on layout needs.
-   Border widths, corner radii, and shadows.
-   Component sizes and interaction states.
-   Motion durations and easing where animation is justified.
-   Light and dark themes when required.

Do not scatter arbitrary hardcoded values throughout the application
when tokens are appropriate. Do not use the brand color for every
element. Check text contrast rather than assuming a muted color is
readable on every background. Do not implement dark mode by simply
inverting colors.

Example starting points---not universal requirements:

-   Page title: 28--36 px on desktop.
-   Section heading: 20--24 px.
-   Component heading: 16--18 px.
-   Body text: 14--16 px.
-   Labels: 13--14 px.
-   Supporting text: 12--13 px, used sparingly.
-   Spacing scale: 4, 8, 12, 16, 24, 32, and 48 px.

Adjust these values to the typeface, product density, device, and
accessibility needs.

## 16. Typography and layout

-   Use a controlled typography scale rather than choosing arbitrary
    sizes per component.
-   Keep headings, body text, labels, and metadata visually distinct.
-   Avoid excessive font families, unrelated weights, and all-caps text
    everywhere.
-   Avoid making every heading oversized and bold.
-   Keep reading-oriented content at a sensible line length.
-   Align titles, content, and section edges to a coherent layout grid.
-   Use flexible layouts rather than arbitrary fixed widths.
-   Give related elements consistent spacing and separate unrelated
    sections clearly.
-   Avoid excessive whitespace that hides essential content.
-   Use compact density for data-heavy applications only when it
    improves productivity.

## 17. Component design

Build and reuse components appropriate to the project, such as:

-   Buttons and icon buttons.
-   Inputs, selects, textareas, checkboxes, and form fields.
-   Navigation, sidebars, headers, and breadcrumbs.
-   Tables, lists, filters, and pagination.
-   Dialogs, drawers, dropdowns, and tooltips.
-   Tabs, badges, alerts, and notifications.
-   Loading indicators, skeletons, empty states, and error states.

For each component:

-   Define its purpose, variants, sizing, and behavior.
-   Standardize spacing, typography, and visual states.
-   Implement accessible labels and keyboard interactions.
-   Support relevant hover, focus, active, disabled, selected, loading,
    success, and error states.
-   Use consistent behavior across pages.
-   Avoid unnecessary abstractions and excessive nesting.
-   Do not duplicate components just to make minor visual changes.
-   Do not force unrelated components to look or behave identically
    merely for reuse.

### Buttons

-   Define primary, secondary, tertiary, and destructive variants when
    needed.
-   Standardize dimensions, padding, icons, and typography.
-   Avoid multiple competing primary actions in the same action area.
-   Include disabled, loading, focus, and hover states.

### Forms and inputs

-   Keep labels visible and associate them with controls.
-   Explain required fields and validation errors.
-   Preserve user input appropriately after errors.
-   Show submission progress and confirmation.
-   Use suitable input types and autocomplete.
-   Validate on both the client and server.

### Tables and data lists

-   Support long values, loading, empty states, and errors.
-   Align numeric data consistently.
-   Use meaningful column labels and appropriate sorting.
-   Handle pagination and small screens deliberately.
-   Avoid displaying every database field by default.

### Dialogs and notifications

-   Use dialogs when interruption or confirmation is justified.
-   Explain destructive actions clearly.
-   Provide suitable focus management and keyboard dismissal.
-   Keep notifications concise and actionable.
-   Do not use a modal for every routine interaction.

## 18. Responsive design

-   Design for mobile, tablet, laptop, and wide desktop viewports.
-   Choose breakpoints based on content and layout requirements, not
    device labels alone.
-   Use flexible layouts, suitable maximum widths, and appropriate text
    wrapping.
-   Prevent horizontal overflow, clipped content, overlapping elements,
    and unusable controls.
-   Adapt navigation, forms, tables, and complex components for narrow
    screens.
-   Preserve essential functionality at every supported viewport.
-   Do not rely exclusively on hover for essential information.
-   Check touch targets, zoom, long text, translated content, and
    variable data lengths.
-   Avoid fixed positioning that covers essential content.
-   Do not hide essential functionality on mobile without providing an
    alternative.

## 19. Accessibility

-   Use semantic HTML and appropriate accessible component patterns.
-   Aim for WCAG 2.2 Level AA where applicable.
-   Maintain sufficient text and interface contrast.
-   Associate labels with form controls.
-   Make focus indicators visible.
-   Support keyboard navigation and logical focus order.
-   Announce important dynamic feedback appropriately to assistive
    technologies.
-   Provide accessible names for icon-only controls.
-   Do not communicate status through color alone.
-   Provide text alternatives for meaningful images.
-   Respect reduced-motion settings.
-   Test critical interactions rather than assuming semantic markup
    alone guarantees accessibility.

## 20. Real data and UI states

-   Design around realistic content rather than empty placeholders.
-   Never fabricate production metrics, user records, charts,
    testimonials, or statuses.
-   Clearly label sample data in demonstrations.
-   Handle missing images, long names, empty lists, large numbers, and
    variable text lengths.
-   Format dates, currency, numbers, and time consistently with locale
    requirements.
-   Avoid fixed-height content areas that clip legitimate data.
-   Handle loading, empty, error, permission-denied, expired-session,
    and success states where relevant.
-   Do not expose information the current user is not authorized to
    access.

## 21. CSS and frontend quality

-   Follow the existing styling conventions and architecture.
-   Prefer design tokens, reusable styles, and clear component
    boundaries.
-   Avoid unnecessary global CSS and unintended style leakage.
-   Avoid excessive `!important`, duplicated overrides, and fragile
    selectors.
-   Do not use inline styles everywhere as a substitute for an organized
    styling system.
-   Do not introduce multiple competing styling frameworks without
    justification.
-   Avoid unnecessary dependencies and oversized client-side bundles.
-   Preserve existing functionality and unrelated user changes.
-   Clean up obsolete styles when changing components.
-   Use semantic elements rather than recreating standard controls
    unnecessarily.
-   Ensure the implementation works with the project's actual framework
    and version.

## 22. Interaction rules

-   Every interactive element must perform its advertised action.
-   Make navigation, tabs, filters, sorting, pagination, dialogs, and
    forms functional.
-   Display loading, success, and error feedback at the appropriate
    time.
-   Prevent duplicate submissions when necessary.
-   Preserve user input appropriately when validation fails.
-   Make destructive actions understandable and require confirmation
    when warranted.
-   Do not show a success state until the operation has actually
    succeeded.
-   Handle API failures, empty responses, permission errors, and expired
    sessions.
-   Provide keyboard-accessible alternatives to pointer interactions.
-   Respect reduced-motion preferences and avoid unnecessary animation.

------------------------------------------------------------------------

# Part VII --- Design Blueprint Before Coding

## 23. Required blueprint for substantial UI work

Before implementing a substantial page or application, define:

1.  Product purpose and target audience.
2.  User goals, primary workflows, and acceptance criteria.
3.  Information architecture: pages, navigation, and hierarchy.
4.  User flows: steps, decisions, errors, and completion states.
5.  Visual direction: brand personality, references, and design
    principles.
6.  Design tokens: color, typography, spacing, borders, radii, and
    elevation.
7.  Component inventory: shared components, variants, and behavior.
8.  Page wireframes: section order, placement, content density, and key
    actions.
9.  Responsive behavior: how layouts adapt at different widths.
10. Interaction specifications: clicks, keyboard behavior, validation,
    loading, and feedback.
11. Accessibility requirements.
12. Data requirements: real data, empty states, long content, and error
    scenarios.
13. Acceptance criteria: measurable conditions for completion.

For larger systems, also identify reusable page templates, navigation
permissions, design-system ownership, and visual regression testing.

For small changes, use a proportionate plan rather than creating
unnecessary documentation. Do not begin a large redesign until the major
structure, visual direction, and important interactions are understood.

------------------------------------------------------------------------

# Part VIII --- Testing and Quality Assurance

## 24. Required testing types

-   Unit tests: individual functions, calculations, and business rules.
-   Integration tests: APIs, databases, authentication, and service
    boundaries.
-   End-to-end tests: complete user workflows.
-   Security tests: authorization failures, injection risks, and
    relevant vulnerabilities.
-   Regression tests: previously fixed defects remain fixed.
-   Build and type checks: the project compiles and satisfies configured
    checks.
-   Performance tests: important operations remain usable under expected
    load.
-   Visual checks: layout, typography, spacing, responsiveness, and
    component consistency.

## 25. Testing rules

-   Never test only the happy path.
-   Test unauthorized access and different user roles.
-   Test invalid input, missing records, duplicate requests, and network
    failures.
-   Test concurrent updates and partial failures where relevant.
-   Never ignore failing tests.
-   Never delete or weaken tests merely because the implementation
    fails.
-   Never use production customer data in tests without an explicitly
    approved, safe process.
-   Never claim coverage or test success without evidence.
-   Report tests that could not run and explain why.
-   Do not claim visual verification if the interface was not actually
    inspected.

## 26. Visual quality assurance

When browser or screenshot inspection is available:

-   Inspect the rendered application rather than relying only on source
    code.
-   Compare the result with the blueprint and approved reference.
-   Check alignment, spacing, typography, color, hierarchy, and
    component consistency.
-   Test narrow and wide viewports.
-   Inspect overflow, clipping, scrolling, sticky elements, and
    overlapping layers.
-   Test menus, dialogs, forms, navigation, and keyboard interactions.
-   Check loading, empty, error, and success states.
-   Correct the underlying cause of visual defects.
-   Reinspect after making fixes.
-   Distinguish actual visual verification from source-code review.

------------------------------------------------------------------------

# Part IX --- Reliability, Performance, and Error Handling

## 27. Reliability

-   Never assume external services are always available.
-   Use timeouts for network and long-running operations where
    appropriate.
-   Never retry indefinitely.
-   Never retry non-idempotent operations blindly.
-   Consider duplicate side effects before retrying.
-   Use backoff where retries are appropriate.
-   Track important background jobs and failures.
-   Handle partial failures and prevent unrelated components from
    failing unnecessarily.
-   Provide useful monitoring and diagnostics without exposing sensitive
    data.

## 28. Performance

-   Avoid unnecessary re-renders, expensive effects, and excessive
    animations.
-   Optimize images and assets appropriately.
-   Lazy-load expensive or below-the-fold content when beneficial.
-   Avoid large blocking assets and prevent layout shifts.
-   Keep interactions responsive.
-   Avoid dependencies for effects achievable with the existing stack.
-   Measure performance when it matters rather than making unsupported
    claims.
-   Optimize database queries and large datasets according to actual
    access patterns.

## 29. Honest error handling

-   Never swallow exceptions silently.
-   Use actionable, safe error messages.
-   Record useful diagnostic information without sensitive data.
-   Distinguish confirmed facts, assumptions, and unresolved problems.
-   Never fabricate logs, API responses, test results, or verification
    evidence.
-   Do not hide incomplete work or known limitations.

------------------------------------------------------------------------

# Part X --- Git, Environments, and Deployment

## 30. Protect the repository

-   Inspect version-control status before modifying files.
-   Preserve unrelated user changes.
-   Keep changes focused on the task.
-   Never overwrite files or discard work without authorization.
-   Never reset shared work or force-push without explicit
    authorization.
-   Review the final diff for unintended changes, exposed secrets, and
    regressions.
-   Document significant configuration or architectural changes.

## 31. Deploy safely

-   Keep development and production configuration separate.
-   Use secure secret management and least-privilege service accounts.
-   Review migrations and deployment impact before execution.
-   Require explicit authorization for consequential production
    operations.
-   Use backups, health checks, monitoring, and recovery plans
    appropriate to the system.
-   Never report a deployment as successful without verifying the
    result.
-   Never disable security checks to bypass deployment errors.
-   Never expose databases, administrative interfaces, or internal
    services publicly without appropriate protection.
-   Prepare rollback or recovery procedures for risky changes.

------------------------------------------------------------------------

# Part XI --- AI Behavior and Workflow

## 32. How the AI must make decisions

-   Never guess when a wrong assumption could compromise security, data
    integrity, or major functionality.
-   Never invent project files, endpoints, schemas, configuration, or
    dependency versions.
-   Never start changing files before understanding the relevant
    architecture and conventions.
-   Never solve a symptom with a workaround while ignoring the
    underlying cause.
-   Never implement a feature without tracing its impact across the
    frontend, backend, database, and related workflows.
-   Never silently change requirements or remove existing functionality.
-   Never repeat failed approaches without investigating why they
    failed.
-   Never install unnecessary dependencies.
-   Never mark work complete while important acceptance criteria remain
    unmet.
-   Never assume permission to charge money, send messages, delete data,
    deploy, or perform other consequential actions.
-   Ask focused questions when critical information or authorization is
    missing.
-   For low-risk ambiguity, state assumptions and proceed reasonably.
-   For substantial changes, provide a concise plan before
    implementation.
-   Keep changes proportionate to the task.

## 33. Required development workflow

For each substantial task:

1.  Inspect the repository and requirements.
2.  Identify risks, dependencies, and acceptance criteria.
3.  Prepare a concise implementation and design plan.
4.  Implement the smallest coherent solution.
5.  Connect real application functionality.
6.  Test the affected behavior.
7.  Run relevant regression checks.
8.  Review security, data integrity, accessibility, and unintended side
    effects.
9.  Inspect the rendered UI when possible.
10. Update documentation and configuration examples where necessary.
11. Review the final diff.
12. Report changes, verification evidence, and remaining limitations.

Do not move past a blocking failure without resolving it or explicitly
explaining why it remains unresolved.

------------------------------------------------------------------------

# Part XII --- Definition of Done

## 34. A feature is complete only when

-   Its acceptance criteria are satisfied.
-   It integrates correctly with the existing system.
-   Security and authorization requirements are addressed.
-   Data validation, integrity, and error handling are implemented.
-   The UI follows the intended design direction.
-   Responsive and accessibility requirements are addressed.
-   Interactive controls work as expected.
-   Relevant loading, empty, error, and success states exist.
-   Relevant tests and checks have been run and their results reported
    honestly.
-   Visual checks have been performed where tools allow.
-   No known critical regression remains unaddressed.
-   Necessary documentation has been updated.
-   Remaining limitations and unverified behavior are disclosed.

A generated code file, successful compilation, or visually complete
interface does not alone constitute a finished feature.

------------------------------------------------------------------------

# Final Principle

Prefer a simple, secure, understandable, accessible, and tested solution
over a complicated, fragile, or unverified one.

Design with intention. Code with consistency. Protect user data. Test
real workflows. Inspect the rendered interface. Preserve existing work.
Never sacrifice security, data integrity, usability, maintainability, or
user trust for implementation speed.

When a requirement cannot be met safely or verified with the available
tools, explain the limitation and propose the safest viable alternative.
Never conceal incomplete work or claim success without evidence.
