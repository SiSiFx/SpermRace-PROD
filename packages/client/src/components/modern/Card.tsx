import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { useThemeClasses } from "../../theme/theme-context";

/**
 * Card elevation levels
 */
export type CardElevation = "none" | "sm" | "md" | "lg" | "xl";

/**
 * Card props
 */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
	elevation?: CardElevation;
	hoverable?: boolean;
	padding?: "none" | "sm" | "md" | "lg";
	children: ReactNode;
}

/**
 * Elevation shadow classes
 */
const elevationStyles: Record<CardElevation, string> = {
	none: "",
	sm: "shadow-sm",
	md: "shadow-md",
	lg: "shadow-lg",
	xl: "shadow-xl",
};

/**
 * Padding styles
 */
const paddingStyles: Record<NonNullable<CardProps["padding"]>, string> = {
	none: "",
	sm: "p-4",
	md: "p-6",
	lg: "p-8",
};

/**
 * Card Component
 * Modern card with elevation variants
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
	(
		{
			elevation = "md",
			hoverable = false,
			padding = "md",
			className = "",
			children,
			...props
		},
		ref,
	) => {
		const { theme } = useThemeClasses();

		const baseStyles = "rounded-xl transition-all duration-200 ease-out";

		const themeStyles = theme === "dark"
			? "bg-gray-800 border border-gray-700"
			: "bg-white border border-gray-200";

		const hoverStyles = hoverable
			? theme === "dark"
				? "hover:shadow-lg hover:border-gray-600 hover:-translate-y-0.5"
				: "hover:shadow-lg hover:border-gray-300 hover:-translate-y-0.5"
			: "";

		const classes = `${baseStyles} ${themeStyles} ${elevationStyles[elevation]} ${paddingStyles[padding]} ${hoverStyles} ${className}`.trim();

		return (
			<div ref={ref} className={classes} {...props}>
				{children}
			</div>
		);
	},
);

Card.displayName = "Card";

/**
 * Card Header Component
 */
export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
	children: ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
	({ className = "", children, ...props }, ref) => {
		return (
			<div
				ref={ref}
				className={`flex flex-col space-y-1.5 p-6 ${className}`.trim()}
				{...props}
			>
				{children}
			</div>
		);
	},
);

CardHeader.displayName = "CardHeader";

/**
 * Card Title Component
 */
export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
	children: ReactNode;
}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
	({ className = "", children, ...props }, ref) => {
		return (
			<h3
				ref={ref}
				className={`text-2xl font-semibold leading-none tracking-tight ${className}`.trim()}
				{...props}
			>
				{children}
			</h3>
		);
	},
);

CardTitle.displayName = "CardTitle";

/**
 * Card Description Component
 */
export interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
	children: ReactNode;
}

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
	({ className = "", children, ...props }, ref) => {
		return (
			<p
				ref={ref}
				className={`text-sm text-gray-500 dark:text-gray-400 ${className}`.trim()}
				{...props}
			>
				{children}
			</p>
		);
	},
);

CardDescription.displayName = "CardDescription";

/**
 * Card Content Component
 */
export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
	children: ReactNode;
}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
	({ className = "", children, ...props }, ref) => {
		return (
			<div ref={ref} className={`p-6 pt-0 ${className}`.trim()} {...props}>
				{children}
			</div>
		);
	},
);

CardContent.displayName = "CardContent";

/**
 * Card Footer Component
 */
export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
	children: ReactNode;
}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
	({ className = "", children, ...props }, ref) => {
		return (
			<div
				ref={ref}
				className={`flex items-center p-6 pt-0 ${className}`.trim()}
				{...props}
			>
				{children}
			</div>
		);
	},
);

CardFooter.displayName = "CardFooter";
