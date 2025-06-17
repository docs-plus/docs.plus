// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

export default (clamp, gripper, editor, prob) => {
  let initialAngle = 0;
  let center = {};

  function calculateMargin(rotation) {
    const rect = gripper.getBoundingClientRect();

    const radianAngle = (rotation * Math.PI) / 180;

    // Calculate the dimensions of the bounding box around the rotated image
    const sinAngle = Math.abs(Math.sin(radianAngle));
    const cosAngle = Math.abs(Math.cos(radianAngle));

    const width = rect.width * cosAngle + rect.height * sinAngle;
    const height = rect.width * sinAngle + rect.height * cosAngle;

    // Calculate the additional margin required to accommodate the rotated image
    const deltaX = width - rect.width;
    const deltaY = height - rect.height;

    return `${deltaY / 2}px ${deltaX / 2}px`;
  }

  clamp.addEventListener("mousedown", function (e) {
    e.preventDefault();

    const rect = gripper.getBoundingClientRect();
    center = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };

    const st = window.getComputedStyle(gripper, null);
    const tr = st.getPropertyValue("transform");

    if (tr !== "none") {
      const values = tr.split("(")[1].split(")")[0].split(",");
      const a = parseFloat(values[0]);
      const b = parseFloat(values[1]);
      initialAngle = Math.round(Math.atan2(b, a) * (180 / Math.PI));
    } else {
      initialAngle = 0;
    }

    const clickAngle = Math.atan2(e.clientY - center.y, e.clientX - center.x) * (180 / Math.PI);
    initialAngle = clickAngle - initialAngle;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  });

  function handleMouseMove(e) {
    const moveAngle = Math.atan2(e.clientY - center.y, e.clientX - center.x) * (180 / Math.PI);
    const rotation = (moveAngle - initialAngle + 360) % 360;

    gripper.style.transform = `rotate(${rotation}deg)`;
  }

  function handleMouseUp() {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);

    const { state, dispatch } = editor.view;
    const { tr } = state;
    const currentNodePos = prob.from || null;

    if (currentNodePos) {
      const margin = calculateMargin(initialAngle);
      tr.setNodeAttribute(currentNodePos, "margin", margin);
      tr.setNodeAttribute(currentNodePos, "transform", gripper.style.transform);
      tr.setMeta("rotateMedia", true);
      tr.setMeta("addToHistory", true);
      dispatch(tr);
    }
  }
};
