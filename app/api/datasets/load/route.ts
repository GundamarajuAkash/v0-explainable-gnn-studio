import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/datasets/load
 * Returns all datasets from Supabase using raw SQL (bypasses PostgREST schema cache).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    
    // Use raw SQL to bypass PostgREST schema cache issues
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT id, name, num_nodes, num_edges, num_features, num_classes, 
               density, avg_degree, class_counts, imbalance_ratio, 
               major_class, minor_class, is_builtin, created_at
        FROM datasets
        ORDER BY created_at DESC
      `
    });

    // If the RPC doesn't exist, fall back to direct query
    if (error && error.code === 'PGRST202') {
      // Try direct from() - maybe schema cache has refreshed
      const { data: directData, error: directError } = await supabase
        .from("datasets")
        .select("id, name, num_nodes, num_edges, num_features, num_classes, density, avg_degree, class_counts, imbalance_ratio, major_class, minor_class, is_builtin, created_at")
        .order("created_at", { ascending: false });

      if (directError) {
        // Return empty array if table doesn't exist yet in cache
        if (directError.code === 'PGRST205') {
          console.log("[datasets/load] Table not in schema cache yet, returning empty");
          return NextResponse.json({
            status: "success",
            data: [],
          });
        }
        console.error("[datasets/load] Supabase query error:", directError);
        return NextResponse.json(
          { status: "error", message: `Database error: ${directError.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        status: "success",
        data: directData || [],
      });
    }

    if (error) {
      // Return empty array if there's a schema cache issue
      console.log("[datasets/load] RPC error, returning empty:", error.message);
      return NextResponse.json({
        status: "success", 
        data: [],
      });
    }

    return NextResponse.json({
      status: "success",
      data: data || [],
    });
  } catch (err) {
    console.error("[datasets/load] Error:", err);
    return NextResponse.json(
      { status: "error", message: "Failed to load datasets" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/datasets/load
 * Load a specific dataset by ID from Supabase.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { dataset, dataset_id } = payload;

    // Accept either 'dataset' (name) or 'dataset_id' (id)
    const identifier = dataset_id || dataset;

    if (!identifier) {
      return NextResponse.json(
        { status: "error", message: "Dataset name or ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // Try to find by ID first, then by name
    let query = supabase
      .from("datasets")
      .select("id, name, num_nodes, num_edges, num_features, num_classes, density, avg_degree, class_counts, imbalance_ratio, major_class, minor_class, is_builtin");
    
    // Check if it looks like an ID (contains hyphens or is lowercase)
    if (identifier.includes("-") || identifier === identifier.toLowerCase()) {
      query = query.eq("id", identifier);
    } else {
      // Search by name (case-insensitive)
      query = query.ilike("name", identifier);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return NextResponse.json(
        { status: "error", message: `Dataset not found: ${identifier}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: "success",
      message: `Loaded ${data.name}`,
      data,
    });
  } catch (err) {
    console.error("[datasets/load] Error:", err);
    return NextResponse.json(
      { status: "error", message: "Failed to load dataset" },
      { status: 500 }
    );
  }
}
