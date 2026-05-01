export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      balance_prueba_lineas: {
        Row: {
          anexo: string | null
          balance_id: string
          cuenta: string
          f2516: string | null
          id: number
          nombre: string | null
          renglon_110: number | null
          saldo: number
        }
        Insert: {
          anexo?: string | null
          balance_id: string
          cuenta: string
          f2516?: string | null
          id?: number
          nombre?: string | null
          renglon_110?: number | null
          saldo?: number
        }
        Update: {
          anexo?: string | null
          balance_id?: string
          cuenta?: string
          f2516?: string | null
          id?: number
          nombre?: string | null
          renglon_110?: number | null
          saldo?: number
        }
        Relationships: [
          {
            foreignKeyName: "balance_prueba_lineas_balance_id_fkey"
            columns: ["balance_id"]
            isOneToOne: false
            referencedRelation: "balance_pruebas"
            referencedColumns: ["id"]
          },
        ]
      }
      balance_pruebas: {
        Row: {
          declaracion_id: string
          filename: string
          id: string
          uploaded_at: string
        }
        Insert: {
          declaracion_id: string
          filename: string
          id?: string
          uploaded_at?: string
        }
        Update: {
          declaracion_id?: string
          filename?: string
          id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "balance_pruebas_declaracion_id_fkey"
            columns: ["declaracion_id"]
            isOneToOne: false
            referencedRelation: "declaraciones"
            referencedColumns: ["id"]
          },
        ]
      }
      ciiu_codigos: {
        Row: {
          codigo: string
          descripcion: string
        }
        Insert: {
          codigo: string
          descripcion: string
        }
        Update: {
          codigo?: string
          descripcion?: string
        }
        Relationships: []
      }
      declaraciones: {
        Row: {
          anios_declarando: string
          ano_gravable: number
          created_at: string
          empresa_id: string
          estado: string
          formato: string
          id: string
          impuesto_neto_anterior: number
          modo_carga: string | null
          updated_at: string
        }
        Insert: {
          anios_declarando?: string
          ano_gravable: number
          created_at?: string
          empresa_id: string
          estado?: string
          formato?: string
          id?: string
          impuesto_neto_anterior?: number
          modo_carga?: string | null
          updated_at?: string
        }
        Update: {
          anios_declarando?: string
          ano_gravable?: number
          created_at?: string
          empresa_id?: string
          estado?: string
          formato?: string
          id?: string
          impuesto_neto_anterior?: number
          modo_carga?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "declaraciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      direcciones_seccionales: {
        Row: {
          codigo: string
          nombre: string
        }
        Insert: {
          codigo: string
          nombre: string
        }
        Update: {
          codigo?: string
          nombre?: string
        }
        Relationships: []
      }
      empresas: {
        Row: {
          ciiu_codigo: string | null
          created_at: string
          direccion_seccional_codigo: string | null
          dv: string | null
          id: string
          nit: string
          profile_id: string
          razon_social: string
          regimen_codigo: string | null
          updated_at: string
        }
        Insert: {
          ciiu_codigo?: string | null
          created_at?: string
          direccion_seccional_codigo?: string | null
          dv?: string | null
          id?: string
          nit: string
          profile_id: string
          razon_social: string
          regimen_codigo?: string | null
          updated_at?: string
        }
        Update: {
          ciiu_codigo?: string | null
          created_at?: string
          direccion_seccional_codigo?: string | null
          dv?: string | null
          id?: string
          nit?: string
          profile_id?: string
          razon_social?: string
          regimen_codigo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresas_ciiu_codigo_fkey"
            columns: ["ciiu_codigo"]
            isOneToOne: false
            referencedRelation: "ciiu_codigos"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "empresas_direccion_seccional_codigo_fkey"
            columns: ["direccion_seccional_codigo"]
            isOneToOne: false
            referencedRelation: "direcciones_seccionales"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "empresas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form110_renglones: {
        Row: {
          ano_gravable: number
          descripcion: string
          formula_xlsm: string | null
          fuente_celda: string | null
          numero: number
          seccion: string
        }
        Insert: {
          ano_gravable: number
          descripcion: string
          formula_xlsm?: string | null
          fuente_celda?: string | null
          numero: number
          seccion: string
        }
        Update: {
          ano_gravable?: number
          descripcion?: string
          formula_xlsm?: string | null
          fuente_celda?: string | null
          numero?: number
          seccion?: string
        }
        Relationships: []
      }
      form110_valores: {
        Row: {
          declaracion_id: string
          numero: number
          valor: number
        }
        Insert: {
          declaracion_id: string
          numero: number
          valor?: number
        }
        Update: {
          declaracion_id?: string
          numero?: number
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "form110_valores_declaracion_id_fkey"
            columns: ["declaracion_id"]
            isOneToOne: false
            referencedRelation: "declaraciones"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          nombre: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          nombre?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nombre?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      puc_accounts: {
        Row: {
          anexo: string | null
          ano_gravable: number
          descripcion: string | null
          f2516: string | null
          puc: string
          renglon_110: number | null
          ttd: string | null
        }
        Insert: {
          anexo?: string | null
          ano_gravable?: number
          descripcion?: string | null
          f2516?: string | null
          puc: string
          renglon_110?: number | null
          ttd?: string | null
        }
        Update: {
          anexo?: string | null
          ano_gravable?: number
          descripcion?: string | null
          f2516?: string | null
          puc?: string
          renglon_110?: number | null
          ttd?: string | null
        }
        Relationships: []
      }
      puc_overrides: {
        Row: {
          created_at: string
          empresa_id: string
          nombre: string | null
          puc: string
          renglon_110: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          nombre?: string | null
          puc: string
          renglon_110?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          nombre?: string | null
          puc?: string
          renglon_110?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "puc_overrides_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      regimenes_tarifas: {
        Row: {
          ano_gravable: number
          codigo: string
          descripcion: string
          tarifa: number
        }
        Insert: {
          ano_gravable: number
          codigo: string
          descripcion: string
          tarifa: number
        }
        Update: {
          ano_gravable?: number
          codigo?: string
          descripcion?: string
          tarifa?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

