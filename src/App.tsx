import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import kebabCase from "lodash/kebabCase";

import "./styles.css";

function getActionButtons(task) {
  const branchName = `${
    task.assignees.length
      ? `${task.assignees
          .map((assignee) => assignee.initials)
          .join("")
          .toLowerCase()}/`
      : ""
  }${kebabCase(task.name)}`;

  return [
    {
      name: "url",
      value: task.url,
      display: (
        <a
          href={task.url}
          target="_blank"
          rel="noreferrer noopener"
          style={{ color: "gray", textDecoration: "none" }}
        >
          {task.url}
        </a>
      ),
    },
    { name: "branch name", value: branchName },
    { name: "new branch", value: `git checkout -b ${branchName}` },
    { name: "checkout", value: `git checkout ${branchName}` },
    { name: "pr name", value: `[CU-${task.id}] ${task.name}` },
  ];
}

export default function App() {
  const personalToken = "pk_60729273_T3CU4EG3J0NCJH0XTOH7E09ESBUB3ODH";
  const sprintsFolder = "90031642828";

  const [shown, setShown] = useState({
    assignee: true,
    status: true,
    id: false,
    actions: true,
    me_mode: false,
  });

  const { data: userData } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const response = await fetch(`https://api.clickup.com/api/v2/user`, {
        method: "GET",
        headers: { Authorization: personalToken },
      });
      if (!response.ok) throw new Error("Getting user was not ok");
      return response.json();
    },
  });

  const { data: listData } = useQuery({
    queryKey: ["lists"],
    queryFn: async () => {
      const response = await fetch(
        `https://api.clickup.com/api/v2/folder/${sprintsFolder}/list`,
        { method: "GET", headers: { Authorization: personalToken } },
      );
      if (!response.ok) throw new Error("Getting lists was not ok");
      return response.json();
    },
  });

  // Queries
  const { data: viewData } = useQuery({
    queryKey: ["view"],
    queryFn: async () => {
      const currentSprint = listData.lists[0];
      const response = await fetch(
        `https://api.clickup.com/api/v2/list/${currentSprint.id}/view`,
        { method: "GET", headers: { Authorization: personalToken } },
      );
      if (!response.ok) throw new Error("Getting view was not ok");
      return response.json();
    },
    enabled: Boolean(listData?.lists.length),
  });

  const { data: tasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const viewId = viewData.required_views.list.id;

      const tasks = [];
      let page = 0;

      const getTasks = async () => {
        const response = await fetch(
          `https://api.clickup.com/api/v2/view/${viewId}/task?page=${page}`,
          { method: "GET", headers: { Authorization: personalToken } },
        );
        if (!response.ok) throw new Error("Getting view task was not ok");
        const result = await response.json();
        tasks.push(...result.tasks);
        if (!result.last_page) {
          page += 1;
          await getTasks();
        }
      };

      await getTasks();
      return tasks;
    },
    enabled: Boolean(viewData),
  });

  const filteredTasks =
    (shown.me_mode
      ? tasks.filter((task) =>
          task.assignees.find(
            (assignee) => assignee.username === userData?.user.username,
          ),
        )
      : tasks) || [];

  return (
    <div className="App">
      <h1>culist</h1>
      <p>
        Ronna&apos;s handy tool for creating meaningful branch & pull request
        names based on your clickup tasks
      </p>
      <hr />
      <p>hello, {userData?.user.username}!</p>
      <div>
        current sprint: <strong>{listData?.lists?.[0].name}</strong>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        <div>show:</div>
        {["assignee", "status", "id", "actions", "me_mode"].map((property) => (
          <div key={property}>
            <label style={{ whiteSpace: "nowrap" }}>
              [
              <input
                type="checkbox"
                checked={shown[property]}
                onChange={() =>
                  setShown((p) => ({ ...p, [property]: !p[property] }))
                }
              />
              {property}]
            </label>
          </div>
        ))}
      </div>
      <ul>
        {filteredTasks.map((task) => (
          <li key={task.id}>
            <div>
              {shown.assignee &&
                task.assignees.map((assignee) => (
                  <span
                    key={assignee.id}
                    style={{ background: assignee.color, color: "white" }}
                  >
                    {assignee.initials}
                  </span>
                ))}{" "}
              {shown.status && (
                <span style={{ background: task.status.color, color: "white" }}>
                  {task.status.status}
                </span>
              )}{" "}
              {shown.id && <span>[CU-{task.id}]</span>}{" "}
              <strong>{task.name}</strong>
            </div>
            {shown.actions && (
              <ul style={{ color: "gray" }}>
                {getActionButtons(task).map((action) => (
                  <li key={action.name}>
                    <div style={{ display: "flex" }}>
                      <button
                        style={{ marginRight: 8, whiteSpace: "nowrap" }}
                        onClick={() => {
                          navigator.clipboard.writeText(action.value);
                        }}
                      >
                        {action.name}
                      </button>
                      <div style={{ whiteSpace: "nowrap" }}>
                        {action.display ?? action.value}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
