"use client";

import { Plus, Save } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type RestaurantPayload = {
  restaurant_config: {
    name: string;
    slug: string;
    email_config?: {
      default_recipient?: string;
      from_email?: string;
    };
    employees: Array<{
      name: string;
      role: string;
      preferred_stations?: string[];
      training_on?: string[];
      capabilities: Record<string, string>;
    }>;
    am_stations: Array<{ name: string; shift: string }>;
    pm_stations: Array<{ name: string; shift: string; merge_with?: string | null; peak_headcount?: number; slow_headcount?: number }>;
    slow_merged_stations?: Array<{ name: string; shift: string }>;
  };
  week_config: Record<string, unknown>;
};

export function SettingsEditor({ kitchenStateContent }: { kitchenStateContent: string }) {
  const [payload, setPayload] = useState<RestaurantPayload | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    void fetch("/api/restaurant")
      .then((response) => response.json())
      .then((data: RestaurantPayload) => {
        setPayload(data);
        setNotes(JSON.stringify(data.week_config, null, 2));
      });
  }, []);

  async function save() {
    if (!payload) {
      return;
    }
    setStatus("Saving...");
    const response = await fetch("/api/restaurant", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurant_config: payload.restaurant_config,
        week_config: JSON.parse(notes),
      }),
    });
    setStatus(response.ok ? "Saved restaurant settings." : "Save failed.");
  }

  if (!payload) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-[hsl(var(--muted-foreground))]">Loading restaurant settings...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Restaurant basics</CardTitle>
          <CardDescription>Name, slug, and email defaults used throughout the workflow.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium">Restaurant name</span>
            <Input
              value={payload.restaurant_config.name}
              onChange={(event) =>
                setPayload({
                  ...payload,
                  restaurant_config: { ...payload.restaurant_config, name: event.target.value },
                })
              }
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Slug</span>
            <Input
              value={payload.restaurant_config.slug}
              onChange={(event) =>
                setPayload({
                  ...payload,
                  restaurant_config: { ...payload.restaurant_config, slug: event.target.value },
                })
              }
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Default email recipient</span>
            <Input
              value={payload.restaurant_config.email_config?.default_recipient ?? ""}
              onChange={(event) =>
                setPayload({
                  ...payload,
                  restaurant_config: {
                    ...payload.restaurant_config,
                    email_config: {
                      ...(payload.restaurant_config.email_config ?? {}),
                      default_recipient: event.target.value,
                    },
                  },
                })
              }
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">From email</span>
            <Input
              value={payload.restaurant_config.email_config?.from_email ?? ""}
              onChange={(event) =>
                setPayload({
                  ...payload,
                  restaurant_config: {
                    ...payload.restaurant_config,
                    email_config: {
                      ...(payload.restaurant_config.email_config ?? {}),
                      from_email: event.target.value,
                    },
                  },
                })
              }
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Staff roster</CardTitle>
              <CardDescription>Capabilities, preferred stations, and training tracks.</CardDescription>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setPayload({
                  ...payload,
                  restaurant_config: {
                    ...payload.restaurant_config,
                    employees: [
                      ...payload.restaurant_config.employees,
                      { name: "New staff", role: "pm_staff", capabilities: {} },
                    ],
                  },
                })
              }
            >
              <Plus className="h-4 w-4" />
              Add staff
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {payload.restaurant_config.employees.map((employee, index) => (
            <div key={`${employee.name}-${index}`} className="space-y-3 rounded-xl border border-[hsl(var(--border))] p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={employee.name}
                  onChange={(event) => {
                    const employees = [...payload.restaurant_config.employees];
                    employees[index] = { ...employee, name: event.target.value };
                    setPayload({ ...payload, restaurant_config: { ...payload.restaurant_config, employees } });
                  }}
                />
                <Input
                  value={employee.role}
                  onChange={(event) => {
                    const employees = [...payload.restaurant_config.employees];
                    employees[index] = { ...employee, role: event.target.value };
                    setPayload({ ...payload, restaurant_config: { ...payload.restaurant_config, employees } });
                  }}
                />
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                <Textarea
                  className="min-h-[96px]"
                  value={Object.entries(employee.capabilities)
                    .map(([station, level]) => `${station}:${level}`)
                    .join("\n")}
                  placeholder="Capabilities"
                  onChange={(event) => {
                    const capabilities = Object.fromEntries(
                      event.target.value
                        .split("\n")
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .map((line) => {
                          const [station, level] = line.split(":");
                          return [station.trim(), (level || "stable").trim()];
                        }),
                    );
                    const employees = [...payload.restaurant_config.employees];
                    employees[index] = { ...employee, capabilities };
                    setPayload({ ...payload, restaurant_config: { ...payload.restaurant_config, employees } });
                  }}
                />
                <Textarea
                  className="min-h-[96px]"
                  value={(employee.preferred_stations ?? []).join("\n")}
                  placeholder="Preferred stations"
                  onChange={(event) => {
                    const employees = [...payload.restaurant_config.employees];
                    employees[index] = {
                      ...employee,
                      preferred_stations: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean),
                    };
                    setPayload({ ...payload, restaurant_config: { ...payload.restaurant_config, employees } });
                  }}
                />
                <Textarea
                  className="min-h-[96px]"
                  value={(employee.training_on ?? []).join("\n")}
                  placeholder="Training stations"
                  onChange={(event) => {
                    const employees = [...payload.restaurant_config.employees];
                    employees[index] = {
                      ...employee,
                      training_on: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean),
                    };
                    setPayload({ ...payload, restaurant_config: { ...payload.restaurant_config, employees } });
                  }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Station structure</CardTitle>
          <CardDescription>AM and PM station definitions used by the deterministic scheduler.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">AM stations</p>
            {payload.restaurant_config.am_stations.map((station, index) => (
              <div key={`${station.name}-${index}`} className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={station.name}
                  onChange={(event) => {
                    const amStations = [...payload.restaurant_config.am_stations];
                    amStations[index] = { ...station, name: event.target.value };
                    setPayload({ ...payload, restaurant_config: { ...payload.restaurant_config, am_stations: amStations } });
                  }}
                />
                <Input
                  value={station.shift}
                  onChange={(event) => {
                    const amStations = [...payload.restaurant_config.am_stations];
                    amStations[index] = { ...station, shift: event.target.value };
                    setPayload({ ...payload, restaurant_config: { ...payload.restaurant_config, am_stations: amStations } });
                  }}
                />
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">PM stations</p>
            {payload.restaurant_config.pm_stations.map((station, index) => (
              <div key={`${station.name}-${index}`} className="grid gap-3 rounded-xl border border-[hsl(var(--border))] p-4 lg:grid-cols-4">
                <Input
                  value={station.name}
                  onChange={(event) => {
                    const pmStations = [...payload.restaurant_config.pm_stations];
                    pmStations[index] = { ...station, name: event.target.value };
                    setPayload({ ...payload, restaurant_config: { ...payload.restaurant_config, pm_stations: pmStations } });
                  }}
                />
                <Input
                  value={station.merge_with ?? ""}
                  placeholder="Merge with"
                  onChange={(event) => {
                    const pmStations = [...payload.restaurant_config.pm_stations];
                    pmStations[index] = { ...station, merge_with: event.target.value || null };
                    setPayload({ ...payload, restaurant_config: { ...payload.restaurant_config, pm_stations: pmStations } });
                  }}
                />
                <Input
                  value={String(station.peak_headcount ?? 1)}
                  onChange={(event) => {
                    const pmStations = [...payload.restaurant_config.pm_stations];
                    pmStations[index] = { ...station, peak_headcount: Number(event.target.value || 1) };
                    setPayload({ ...payload, restaurant_config: { ...payload.restaurant_config, pm_stations: pmStations } });
                  }}
                />
                <Input
                  value={String(station.slow_headcount ?? 1)}
                  onChange={(event) => {
                    const pmStations = [...payload.restaurant_config.pm_stations];
                    pmStations[index] = { ...station, slow_headcount: Number(event.target.value || 1) };
                    setPayload({ ...payload, restaurant_config: { ...payload.restaurant_config, pm_stations: pmStations } });
                  }}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Baseline week JSON</CardTitle>
          <CardDescription>Stored as the editable week baseline for the conversation layer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-[320px] font-mono text-xs" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button onClick={save} className="sm:w-auto">
              <Save className="h-4 w-4" />
              Save settings
            </Button>
            {status ? <p className="text-sm text-[hsl(var(--muted-foreground))]">{status}</p> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kitchen state reference</CardTitle>
          <CardDescription>The current human-readable kitchen model used for AI context.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="scrollbar-thin max-h-[420px] overflow-auto rounded-xl bg-[hsl(var(--secondary))]/55 p-4 text-xs leading-6 text-[hsl(var(--foreground))]">
            {kitchenStateContent}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
