import React from "react";

type CheckboxModalProps = {
  id: string;
  children?: React.ReactNode;
  triggerRef: any;
  onCheckboxChange?: any;
};

// Note the use of React.forwardRef here and the inclusion of ref in the function parameters
export const ModalContainer = React.forwardRef<HTMLInputElement, CheckboxModalProps>(
  ({ id, children, triggerRef, onCheckboxChange, ...restProps }, ref) => {
    return (
      <div {...restProps} ref={ref}>
        {/* Assign the ref to the checkbox input */}
        <input
          type="checkbox"
          id={id}
          className="modal-toggle"
          ref={triggerRef}
          onChange={onCheckboxChange}
        />

        <div className="modal" role="dialog">
          <div className="modal-box">{children}</div>
          <label className="modal-backdrop" htmlFor={id}>
            Close
          </label>
        </div>
      </div>
    );
  },
);

ModalContainer.displayName = "ModalContainer";

// Usage:

// import { ModalContainer, ModalTrigger } from "@/components/ui/modal";

// <ModalTrigger id="modal-1">Open Modal</ModalTrigger>
// <ModalContainer id="modal-1">
//   <h1>Modal Title</h1>
//   <p>Modal Content</p>
// </ModalContainer>
