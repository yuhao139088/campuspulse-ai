"use client";
import { useEffect } from "react";
import { RoundedSelect } from "@/components/rounded-select";
import { request, useResource, useText } from "./shared";

export default function WorkspaceControls() {
  const { text } = useText();
  const { data, error } = useResource<{ spaces: { id: string; name: string; role: string }[]; active: string }>("/api/spaces");
  useEffect(() => {
    const theme = localStorage.getItem("campuspulse-theme");
    const motion = localStorage.getItem("campuspulse-motion");
    if (theme) document.documentElement.dataset.theme = theme;
    if (motion) document.documentElement.dataset.motion = motion;
  },[]);
  return <div className="workspace-controls"><label>{text("当前空间", "Workspace")}<RoundedSelect className="language-button" value={data?.active ?? ""} onChange={async (event) => { await request("/api/spaces","PATCH",{id:event.target.value});window.location.reload(); }}>{data?.spaces.map((space) => <option value={space.id} key={space.id}>{space.name} · {space.role}</option>)}</RoundedSelect></label><button className="language-button" onClick={async () => { const name=prompt(text("新社团空间名称","New club workspace name"));if(!name?.trim())return;try{await request("/api/spaces","POST",{name});window.location.reload();}catch(problem){alert(String(problem));} }}>{text("创建社团空间", "Create club workspace")}</button>{error && <span className="auth-error">{error}</span>}</div>;
}
