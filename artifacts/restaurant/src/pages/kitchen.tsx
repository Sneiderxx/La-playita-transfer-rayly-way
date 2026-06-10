import { useQueryClient } from "@tanstack/react-query";
import { 
  useListKitchenTickets, 
  getListKitchenTicketsQueryKey,
  useUpdateKitchenTicketStatus,
  KitchenTicket,
  KitchenTicketStatus
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { statusColors } from "@/lib/format";
import { formatDistanceToNow } from "date-fns";
import { Timer, Check, ChefHat } from "lucide-react";
import { toast } from "sonner";

export default function Kitchen() {
  const queryClient = useQueryClient();
  
  const { data: tickets = [], isLoading } = useListKitchenTickets({ 
    query: { 
      refetchInterval: 10000, 
      queryKey: getListKitchenTicketsQueryKey() 
    } 
  });
  
  const updateStatus = useUpdateKitchenTicketStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKitchenTicketsQueryKey() });
      }
    }
  });

  const handleAdvanceStatus = (ticket: KitchenTicket) => {
    let nextStatus: KitchenTicketStatus;
    if (ticket.status === "pending") nextStatus = "preparing";
    else if (ticket.status === "preparing") nextStatus = "ready";
    else if (ticket.status === "ready") nextStatus = "delivered";
    else return;

    updateStatus.mutate({
      id: ticket.id,
      data: { status: nextStatus }
    });
  };

  const getStatusActionText = (status: KitchenTicketStatus) => {
    if (status === "pending") return "Start Preparing";
    if (status === "preparing") return "Mark Ready";
    if (status === "ready") return "Deliver";
    return "";
  };

  if (isLoading) return <div>Loading Kitchen...</div>;

  const activeTickets = tickets.filter(t => t.status !== "delivered");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Kitchen Display</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Auto-updating
        </div>
      </div>

      {activeTickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-24 text-muted-foreground border-2 border-dashed rounded-xl bg-card">
          <ChefHat className="w-16 h-16 mb-4 opacity-20" />
          <h3 className="text-xl font-medium">All clear!</h3>
          <p>No active tickets right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {activeTickets.map(ticket => (
            <Card key={ticket.id} className={`flex flex-col border-2 ${statusColors[ticket.status] || "border-border"}`}>
              <CardHeader className="p-4 pb-2 border-b bg-muted/20">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">Table #{ticket.tableNumber}</CardTitle>
                    <div className="text-sm opacity-80">{ticket.waiterName}</div>
                  </div>
                  <Badge variant="outline" className="capitalize text-xs font-bold">
                    {ticket.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-xs opacity-70 mt-2 font-mono">
                  <Timer className="w-3 h-3" />
                  {formatDistanceToNow(new Date(ticket.createdAt))}
                </div>
              </CardHeader>
              
              <CardContent className="p-0 flex-1 overflow-y-auto min-h-[150px]">
                <ul className="divide-y divide-border/50">
                  {ticket.items?.map(item => (
                    <li key={item.id} className="p-3">
                      <div className="flex gap-3">
                        <span className="font-bold text-lg">{item.quantity}</span>
                        <div>
                          <div className="font-semibold">{item.productName}</div>
                          {item.notes && (
                            <div className="text-sm bg-background/50 text-foreground/80 mt-1 p-1.5 border-l-2 border-primary">
                              {item.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
              
              <CardFooter className="p-3 border-t bg-muted/10">
                <Button 
                  className="w-full h-12 font-bold" 
                  variant={ticket.status === "ready" ? "default" : "secondary"}
                  onClick={() => handleAdvanceStatus(ticket)}
                  disabled={updateStatus.isPending}
                >
                  <Check className="w-5 h-5 mr-2" />
                  {getStatusActionText(ticket.status)}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
