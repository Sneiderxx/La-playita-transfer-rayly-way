import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListProducts, 
  useListRecipes,
  useListRecipeIngredients,
  useCreateRecipe,
  useDeleteRecipe,
  useReplaceRecipeIngredients,
  useListInventory,
  useListCategories,
  useCreateProduct,
  getListRecipesQueryKey,
  getListRecipeIngredientsQueryKey,
  getListProductsQueryKey,
  Product,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Plus, Save, ChefHat, PackagePlus } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";

export default function Recipes() {
  const queryClient = useQueryClient();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");

  const { data: products = [] } = useListProducts();
  const { data: recipes = [] } = useListRecipes({ query: { queryKey: getListRecipesQueryKey() } });
  const { data: inventory = [] } = useListInventory();
  const { data: categories = [] } = useListCategories();

  const recipe = recipes.find(r => r.productId === selectedProduct?.id);

  const { data: ingredientsData = [] } = useListRecipeIngredients(
    recipe?.id || 0,
    { query: { enabled: !!recipe?.id, queryKey: getListRecipeIngredientsQueryKey(recipe?.id || 0) } }
  );

  const createRecipe = useCreateRecipe();
  const deleteRecipe = useDeleteRecipe();
  const replaceIngredients = useReplaceRecipeIngredients();
  const createProduct = useCreateProduct();

  const [draftIngredients, setDraftIngredients] = useState<Array<{ inventoryItemId: number, quantity: number }>>([]);
  const [isEditing, setIsEditing] = useState(false);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsEditing(false);
  };

  const handleEdit = () => {
    setDraftIngredients(ingredientsData.map(i => ({ inventoryItemId: i.inventoryItemId, quantity: i.quantity })));
    setIsEditing(true);
  };

  const handleCreateRecipe = () => {
    if (!selectedProduct) return;
    createRecipe.mutate({ data: { productId: selectedProduct.id, notes: "" } }, {
      onSuccess: () => {
        toast.success("Receta creada");
        queryClient.invalidateQueries({ queryKey: getListRecipesQueryKey() });
        setIsEditing(true);
        setDraftIngredients([]);
      }
    });
  };

  const handleDeleteRecipe = () => {
    if (!recipe) return;
    if (!confirm(`¿Eliminar la receta de "${selectedProduct?.name}"?`)) return;
    deleteRecipe.mutate({ id: recipe.id }, {
      onSuccess: () => {
        toast.success("Receta eliminada");
        setIsEditing(false);
        setDraftIngredients([]);
        queryClient.invalidateQueries({ queryKey: getListRecipesQueryKey() });
      },
    });
  };

  const handleSave = () => {
    if (!recipe) return;
    replaceIngredients.mutate({ id: recipe.id, data: { ingredients: draftIngredients } }, {
      onSuccess: () => {
        toast.success("Receta guardada");
        setIsEditing(false);
        queryClient.invalidateQueries({ queryKey: getListRecipeIngredientsQueryKey(recipe.id) });
      }
    });
  };

  const handleCreateProduct = () => {
    if (!newName || !newPrice || !newCategoryId) {
      toast.error("Completa todos los campos");
      return;
    }
    createProduct.mutate({
      data: {
        name: newName,
        price: Number(newPrice),
        categoryId: Number(newCategoryId),
        active: true,
      }
    }, {
      onSuccess: (product) => {
        toast.success(`Producto "${newName}" creado`);
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        setNewProductOpen(false);
        setNewName(""); setNewPrice(""); setNewCategoryId("");
        // Seleccionar el producto recién creado
        setSelectedProduct(product);
        setIsEditing(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const addIngredientRow = () => {
    if (inventory.length === 0) return;
    setDraftIngredients([...draftIngredients, { inventoryItemId: inventory[0].id, quantity: 1 }]);
  };

  const updateIngredientRow = (index: number, field: "inventoryItemId" | "quantity", value: number) => {
    const newDraft = [...draftIngredients];
    newDraft[index] = { ...newDraft[index], [field]: value };
    setDraftIngredients(newDraft);
  };

  const removeIngredientRow = (index: number) => {
    setDraftIngredients(draftIngredients.filter((_, i) => i !== index));
  };

  // Calcular costo por plato
  const recipeCost = ingredientsData.reduce((total, ing) => {
    const inv = inventory.find(i => i.id === ing.inventoryItemId);
    return total + (inv ? Number(inv.cost) * Number(ing.quantity) : 0);
  }, 0);

  const margin = selectedProduct && recipeCost > 0
    ? ((Number(selectedProduct.price) - recipeCost) / Number(selectedProduct.price)) * 100
    : null;

  return (
    <div className="flex h-[calc(100vh-100px)] gap-6">
      {/* Panel izquierdo */}
      <Card className="w-1/3 flex flex-col h-full">
        <CardHeader className="pb-3 border-b">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Menú</CardTitle>
              <CardDescription>Selecciona un producto</CardDescription>
            </div>
            <Button size="sm" onClick={() => setNewProductOpen(true)}>
              <PackagePlus className="w-4 h-4 mr-1" /> Nuevo
            </Button>
          </div>
        </CardHeader>
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-1">
            {products.map(product => {
              const hasRecipe = recipes.some(r => r.productId === product.id);
              return (
                <div
                  key={product.id}
                  onClick={() => handleSelectProduct(product)}
                  className={`p-3 rounded-lg cursor-pointer flex justify-between items-center transition-colors ${
                    selectedProduct?.id === product.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  <div>
                    <div className="font-medium text-sm">{product.name}</div>
                    <div className={`text-xs ${selectedProduct?.id === product.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {formatCurrency(Number(product.price))}
                    </div>
                  </div>
                  {hasRecipe && <ChefHat className={`w-4 h-4 flex-shrink-0 ${selectedProduct?.id === product.id ? "text-primary-foreground/70" : "text-muted-foreground"}`} />}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </Card>

      {/* Panel derecho - Editor de receta */}
      <Card className="flex-1 flex flex-col h-full">
        {selectedProduct ? (
          <>
            <CardHeader className="border-b bg-muted/20">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-2xl">{selectedProduct.name}</CardTitle>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-muted-foreground text-sm">Precio: {formatCurrency(Number(selectedProduct.price))}</span>
                    {recipeCost > 0 && (
                      <>
                        <span className="text-muted-foreground text-sm">•</span>
                        <span className="text-sm">Costo: <strong>{formatCurrency(recipeCost)}</strong></span>
                        {margin !== null && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            margin > 40 ? "bg-green-500/20 text-green-400" :
                            margin > 20 ? "bg-yellow-500/20 text-yellow-400" :
                            "bg-red-500/20 text-red-400"
                          }`}>
                            Margen {margin.toFixed(0)}%
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {recipe && !isEditing && (
                  <div className="flex gap-2">
                    <Button onClick={handleEdit} variant="outline">Editar</Button>
                    <Button variant="outline" className="text-destructive hover:bg-destructive/10 border-destructive/30"
                      onClick={handleDeleteRecipe} disabled={deleteRecipe.isPending}>
                      <Trash2 className="w-4 h-4 mr-1" /> Eliminar
                    </Button>
                  </div>
                )}
                {recipe && isEditing && (
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={replaceIngredients.isPending}>
                      <Save className="w-4 h-4 mr-2" /> Guardar
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-6">
              {!recipe ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <ChefHat className="w-16 h-16 mb-4 opacity-20" />
                  <p className="mb-4">Este producto no tiene receta.</p>
                  <Button onClick={handleCreateRecipe} disabled={createRecipe.isPending}>
                    Crear Receta
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {isEditing ? (
                    <div className="space-y-4">
                      {draftIngredients.map((ing, idx) => (
                        <div key={idx} className="flex gap-4 items-end bg-muted/30 p-4 rounded-lg border border-border/50">
                          <div className="flex-1 space-y-2">
                            <Label>Ingrediente</Label>
                            <Select
                              value={ing.inventoryItemId.toString()}
                              onValueChange={(v) => updateIngredientRow(idx, "inventoryItemId", Number(v))}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent className="max-h-48">
                                {inventory.map(inv => (
                                  <SelectItem key={inv.id} value={inv.id.toString()}>
                                    {inv.name} ({inv.unit})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-32 space-y-2">
                            <Label>Cantidad</Label>
                            <Input type="number" step="0.01" value={ing.quantity || ""}
                              onChange={(e) => updateIngredientRow(idx, "quantity", Number(e.target.value))} />
                          </div>
                          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10"
                            onClick={() => removeIngredientRow(idx)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" className="w-full border-dashed" onClick={addIngredientRow}>
                        <Plus className="w-4 h-4 mr-2" /> Agregar Ingrediente
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {ingredientsData.length === 0 ? (
                        <p className="text-muted-foreground italic">No hay ingredientes. Haz click en Editar para agregar.</p>
                      ) : (
                        <div className="divide-y border rounded-lg overflow-hidden">
                          {ingredientsData.map(ing => (
                            <div key={ing.id} className="p-4 flex justify-between items-center bg-card hover:bg-muted/20 transition-colors">
                              <span className="font-medium text-lg">{ing.inventoryItemName}</span>
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-primary">{ing.quantity}</span>
                                <span className="text-sm text-muted-foreground">{ing.unit}</span>
                              </div>
                            </div>
                          ))}
                          {recipeCost > 0 && (
                            <div className="p-4 flex justify-between items-center bg-muted/30 font-medium">
                              <span>Costo total del plato</span>
                              <span className="text-lg font-bold">{formatCurrency(recipeCost)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4">
            <ChefHat className="w-16 h-16 opacity-20" />
            <p>Selecciona un producto para ver su receta</p>
            <Button variant="outline" onClick={() => setNewProductOpen(true)}>
              <PackagePlus className="w-4 h-4 mr-2" /> Crear nuevo producto
            </Button>
          </div>
        )}
      </Card>

      {/* Dialog nuevo producto */}
      <Dialog open={newProductOpen} onOpenChange={setNewProductOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Producto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre del producto</Label>
              <Input placeholder="ej: Naranjada, Mojito, Cerveza" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={newCategoryId} onValueChange={setNewCategoryId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar categoría..." /></SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Precio de venta (Q)</Label>
              <Input type="number" placeholder="0.00" value={newPrice} onChange={e => setNewPrice(e.target.value)} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setNewProductOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleCreateProduct} disabled={createProduct.isPending || !newName || !newPrice || !newCategoryId}>
                {createProduct.isPending ? "Creando..." : "Crear y agregar receta"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
