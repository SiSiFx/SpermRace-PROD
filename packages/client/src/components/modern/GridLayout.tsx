import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

/**
 * Grid column presets
 */
export type GridCols = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/**
 * Responsive grid columns
 */
export interface ResponsiveGridCols {
	sm?: GridCols;
	md?: GridCols;
	lg?: GridCols;
	xl?: GridCols;
	"2xl"?: GridCols;
}

/**
 * Grid props
 */
export interface GridLayoutProps extends HTMLAttributes<HTMLDivElement> {
	cols?: ResponsiveGridCols | GridCols;
	gap?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16;
	alignItems?: "start" | "end" | "center" | "stretch";
	justifyItems?: "start" | "end" | "center" | "stretch";
	children: ReactNode;
}

/**
 * Gap size classes
 */
const gapStyles: Record<NonNullable<GridLayoutProps["gap"]>, string> = {
	0: "gap-0",
	1: "gap-1",
	2: "gap-2",
	3: "gap-3",
	4: "gap-4",
	5: "gap-5",
	6: "gap-6",
	8: "gap-8",
	10: "gap-10",
	12: "gap-12",
	16: "gap-16",
};

/**
 * Build responsive column classes
 */
function buildColClasses(cols: ResponsiveGridCols | GridCols): string {
	if (typeof cols === "number") {
		return `grid-cols-${cols}`;
	}

	const classes: string[] = [];
	if (cols.sm) classes.push(`grid-cols-${cols.sm}:sm`);
	if (cols.md) classes.push(`sm:grid-cols-${cols.md}`);
	if (cols.lg) classes.push(`md:grid-cols-${cols.lg}`);
	if (cols.xl) classes.push(`lg:grid-cols-${cols.xl}`);
	if (cols["2xl"]) classes.push(`xl:grid-cols-${cols["2xl"]}`);

	return classes.join(" ");
}

/**
 * GridLayout Component
 * Responsive CSS Grid layout
 */
export const GridLayout = forwardRef<HTMLDivElement, GridLayoutProps>(
	(
		{
			cols = 1,
			gap = 4,
			alignItems = "stretch",
			justifyItems = "stretch",
			className = "",
			children,
			...props
		},
		ref,
	) => {
		const colClasses = buildColClasses(cols);
		const gapClasses = gapStyles[gap as keyof typeof gapStyles] || gapStyles[4];

		const alignStyles = {
			start: "items-start",
			end: "items-end",
			center: "items-center",
			stretch: "items-stretch",
		};

		const justifyStyles = {
			start: "justify-start",
			end: "justify-end",
			center: "justify-center",
			stretch: "justify-stretch",
		};

		const classes = `grid ${colClasses} ${gapClasses} ${alignStyles[alignItems]} ${justifyStyles[justifyItems]} ${className}`.trim();

		return (
			<div ref={ref} className={classes} {...props}>
				{children}
			</div>
		);
	},
);

GridLayout.displayName = "GridLayout";

/**
 * GridItem Component
 * Wrapper for grid items with span controls
 */
export interface GridItemProps extends HTMLAttributes<HTMLDivElement> {
	colSpan?: GridCols | "auto" | "full";
	rowSpan?: number | "auto";
	children: ReactNode;
}

export const GridItem = forwardRef<HTMLDivElement, GridItemProps>(
	({ colSpan = "auto", rowSpan = "auto", className = "", children, ...props }, ref) => {
		let colClasses = "";
		if (typeof colSpan === "number") {
			colClasses = `col-span-${colSpan}`;
		} else if (colSpan === "full") {
			colClasses = "col-span-full";
		} else if (colSpan === "auto") {
			colClasses = "col-auto";
		}

		const rowClasses = rowSpan === "auto" ? "row-auto" : `row-span-${rowSpan}`;

		const classes = `${colClasses} ${rowClasses} ${className}`.trim();

		return (
			<div ref={ref} className={classes} {...props}>
				{children}
			</div>
		);
	},
);

GridItem.displayName = "GridItem";
