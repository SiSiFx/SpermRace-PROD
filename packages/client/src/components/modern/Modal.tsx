import {
	forwardRef,
	useEffect,
	useCallback,
 useRef,
	type ReactNode,
	type MouseEvent,
	type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useThemeClasses } from "../../theme/theme-context";

/**
 * Modal props
 */
export interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	children: ReactNode;
	title?: string;
	size?: "sm" | "md" | "lg" | "xl" | "full";
	showCloseButton?: boolean;
	closeOnBackdropClick?: boolean;
	closeOnEscape?: boolean;
}

/**
 * Size styles mapping
 */
const sizeStyles: Record<NonNullable<ModalProps["size"]>, string> = {
	sm: "max-w-sm",
	md: "max-w-md",
	lg: "max-w-lg",
	xl: "max-w-xl",
	full: "max-w-full mx-4",
};

/**
 * Modal Component
 * Modern modal with backdrop and animations
 */
export const Modal = forwardRef<HTMLDivElement, ModalProps>(
	(
		{
			isOpen,
			onClose,
			children,
			title,
			size = "md",
			showCloseButton = true,
			closeOnBackdropClick = true,
			closeOnEscape = true,
		},
		ref,
	) => {
		const { theme } = useThemeClasses();
		const modalRef = useRef<HTMLDivElement>(null);

		// Handle escape key
		const handleEscape = useCallback(
			(event: KeyboardEvent) => {
				if (closeOnEscape && event.key === "Escape" && isOpen) {
					onClose();
				}
			},
			[isOpen, onClose, closeOnEscape],
		);

		// Focus trap implementation
		useEffect(() => {
			if (!isOpen) return;

			const modal = modalRef.current;
			if (!modal) return;

			// Get all focusable elements
			const focusableElements = modal.querySelectorAll<
				HTMLButtonElement | HTMLAnchorElement | HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
			>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			const firstElement = focusableElements[0];
			const lastElement = focusableElements[focusableElements.length - 1];

			// Focus first element
			firstElement?.focus();

			// Handle tab key for focus trap
			const handleTab = (e: Event) => {
				const keyboardEvent = e as unknown as KeyboardEvent;
				if (keyboardEvent.key !== "Tab") return;

				if (keyboardEvent.shiftKey) {
					// Shift + Tab
					if (document.activeElement === firstElement) {
						keyboardEvent.preventDefault();
						lastElement?.focus();
					}
				} else {
					// Tab
					if (document.activeElement === lastElement) {
						keyboardEvent.preventDefault();
						firstElement?.focus();
					}
				}
			};

			document.addEventListener("keydown", handleTab);

			return () => {
				document.removeEventListener("keydown", handleTab);
			};
		}, [isOpen]);

		useEffect(() => {
			const handleEscapeWrapper = (e: Event) => {
				const keyboardEvent = e as unknown as KeyboardEvent;
				if (keyboardEvent.key === "Escape") {
					handleEscape(keyboardEvent);
				}
			};
			document.addEventListener("keydown", handleEscapeWrapper);
			return () => {
				document.removeEventListener("keydown", handleEscapeWrapper);
			};
		}, [handleEscape]);

		// Prevent body scroll when modal is open
		useEffect(() => {
			if (isOpen) {
				document.body.style.overflow = "hidden";
				return () => {
					document.body.style.overflow = "";
				};
			}
		}, [isOpen]);

		// Handle backdrop click
		const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
			if (closeOnBackdropClick && event.target === event.currentTarget) {
				onClose();
			}
		};

		if (!isOpen) return null;

		const modalContent = (
			<div className="fixed inset-0 z-[1050] flex items-center justify-center p-4">
				{/* Backdrop */}
				<div
					className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
					onClick={handleBackdropClick}
					aria-hidden="true"
				/>

				{/* Modal */}
				<div
					ref={(node) => {
						// Handle both refs
						if (node) {
							(modalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
							if (typeof ref === "function") {
								ref(node);
							} else if (ref) {
								(ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
							}
						}
					}}
					className={`
						relative w-full ${sizeStyles[size]}
						rounded-xl shadow-2xl
						${theme === "dark" ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"}
						animate-in zoom-in-95 slide-in-from-bottom-4 duration-200
						max-h-[90vh] overflow-hidden flex flex-col
					`.trim()}
					role="dialog"
					aria-modal="true"
					aria-labelledby={title ? "modal-title" : undefined}
				>
					{/* Header */}
					{(title || showCloseButton) && (
						<div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
							{title && (
								<h2 id="modal-title" className="text-xl font-semibold">
									{title}
								</h2>
							)}
							{showCloseButton && (
								<button
									onClick={onClose}
									className={`
										rounded-lg p-2 transition-colors duration-150
										${theme === "dark"
											? "hover:bg-gray-700 text-gray-400 hover:text-white"
											: "hover:bg-gray-100 text-gray-500 hover:text-gray-700"}
									`}
									aria-label="Close modal"
								>
									<svg
										className="w-5 h-5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M6 18L18 6M6 6l12 12"
										/>
									</svg>
								</button>
							)}
						</div>
					)}

					{/* Content */}
					<div className="p-6 overflow-y-auto">{children}</div>
				</div>
			</div>
		);

		return createPortal(modalContent, document.body);
	},
);

Modal.displayName = "Modal";

/**
 * Modal Header Component
 */
export interface ModalHeaderProps {
	children: ReactNode;
}

export function ModalHeader({ children }: ModalHeaderProps) {
	return (
		<div className="mb-4">
			{children}
		</div>
	);
}

/**
 * Modal Body Component
 */
export interface ModalBodyProps {
	children: ReactNode;
	className?: string;
}

export function ModalBody({ children, className = "" }: ModalBodyProps) {
	return <div className={`mb-4 ${className}`.trim()}>{children}</div>;
}

/**
 * Modal Footer Component
 */
export interface ModalFooterProps {
	children: ReactNode;
	className?: string;
}

export function ModalFooter({ children, className = "" }: ModalFooterProps) {
	return (
		<div className={`flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 ${className}`.trim()}>
			{children}
		</div>
	);
}
