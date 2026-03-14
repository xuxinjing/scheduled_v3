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
  const [status, setStatus] = useState<string>("");

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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        restaurant_config: payload.restaurant_config,
        week_config: JSON.parse(notes),
      }),
    });
    setStatus(response.ok ? "Saved restaurant settings." : "Save failed.");
  }

  if (!payload) {
    return <Card><CardContent className="p-6">Loading restaurant settings...</CardContent></Card>;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Roster & Stations</CardTitle>
          <CardDescription>Adjust the stable restaurant truth that rarely changes week to week.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
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
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-heading)] text-lg">Staff roster</h3>
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
            <div className="grid gap-3">
              {payload.restaurant_config.employees.map((employee, index) => (
                <div key={`${employee.name}-${index}`} className="grid gap-3 rounded-[1.5rem] border border-[hsl(var(--border))] bg-white/80 p-4 md:grid-cols-2">
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
                  <Textarea
                    className="min-h-[88px]"
                    value={Object.entries(employee.capabilities)
                      .map(([station, level]) => `${station}:${level}`)
                      .join("\n")}
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
                    className="min-h-[88px]"
                    value={(employee.preferred_stations ?? []).join("\n")}
                    placeholder="Preferred stations, one per line"
                    onChange={(event) => {
                      const employees = [...payload.restaurant_config.employees];
                      employees[index] = {
                        ...employee,
                        preferred_stations: event.target.value
                          .split("\n")
                          .map((line) => line.trim())
                          .filter(Boolean),
                      };
                      setPayload({ ...payload, restaurant_config: { ...payload.restaurant_config, employees } });
                    }}
                  />
                  <Textarea
                    className="min-h-[88px]"
                    value={(employee.training_on ?? []).join("\n")}
                    placeholder="Training stations, one per line"
                    onChange={(event) => {
                      const employees = [...payload.restaurant_config.employees];
                      employees[index] = {
                        ...employee,
                        training_on: event.target.value
                          .split("\n")
                          .map((line) => line.trim())
                          .filter(Boolean),
                      };
                      setPayload({ ...payload, restaurant_config: { ...payload.restaurant_config, employees } });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-[family-name:var(--font-heading)] text-lg">Station structure</h3>
            <div className="space-y-3">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">AM stations</p>
              {payload.restaurant_config.am_stations.map((station, index) => (
                <div key={`${station.name}-${index}`} className="grid gap-3 rounded-[1.25rem] border border-[hsl(var(--border))] bg-white/80 p-4 md:grid-cols-2">
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
              <p className="text-sm text-[hsl(var(--muted-foreground))]">PM stations</p>
              {payload.restaurant_config.pm_stations.map((station, index) => (
                <div key={`${station.name}-${index}`} className="grid gap-3 rounded-[1.25rem] border border-[hsl(var(--border))] bg-white/80 p-4 md:grid-cols-4">
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
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Weekly baseline JSON</CardTitle>
            <CardDescription>Useful for kitchen manager review and email configuration fields.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-[360px] font-mono text-xs" />
            <Button onClick={save} className="w-full">
              <Save className="h-4 w-4" />
              Save settings
            </Button>
            {status && <p className="text-sm text-[hsl(var(--muted-foreground))]">{status}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Scheduling rules reference</CardTitle>
            <CardDescription>Keep the stable roster and merge rules current before weekly runs.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[420px] overflow-auto rounded-[1.25rem] bg-[hsl(var(--muted))]/60 p-4 text-xs leading-6 text-[hsl(var(--foreground))]">
              {kitchenStateContent}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
