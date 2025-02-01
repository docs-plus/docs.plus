addEventListener("message", (event) => {
  const data = event.data;
  const payload = data.payload;
  if (data && data.type === "UPDATE_USER_STATUS" && payload) {
    updateUser(payload);
  }
});

async function updateUser({ userId, status }) {
  if (!userId) {
    console.error("User ID is required to update user status");
    return;
  }
  if (!status) {
    console.error("User status is required to update user status");
    return;
  }

  await fetch("api/updateUserStatus", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, status }),
  })
    .then((response) => {
      if (response.ok) {
        console.info("User status updated successfully!");
      } else {
        console.error("Failed to update user status");
      }
    })
    .catch((error) => {
      console.error("Failed to update user status", error);
    });
}
